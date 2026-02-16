"use server";

import { fetchGitHubData } from "@/lib/github";
import { analyzeProfile } from "@/lib/gemini";
import { checkRateLimit } from "@/lib/rate-limit";
import { headers } from "next/headers";
import type { AnalysisResponse } from "@/lib/types";
import { extractUsername } from "@/lib/utils";
import type { PersonaType } from "@/lib/personas";

// ============================================
// Server Action: The Connector
// ============================================

// --- IN-MEMORY CACHE ---
// Caches successful analysis results keyed by lowercase username.
// Each entry has a TTL (time-to-live) of 10 minutes.
// This prevents redundant API calls for the same profile.
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

interface CacheEntry {
    response: AnalysisResponse;
    timestamp: number;
}

const analysisCache = new Map<string, CacheEntry>();

function getCachedResult(username: string, persona: PersonaType): AnalysisResponse | null {
    const key = `${username.toLowerCase()}:${persona}`;
    const entry = analysisCache.get(key);

    if (!entry) return null;

    // Check if expired
    if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
        analysisCache.delete(key);
        console.log(`[Cache] Expired for: ${key}`);
        return null;
    }

    console.log(`[Cache] HIT for: ${key} (age: ${Math.round((Date.now() - entry.timestamp) / 1000)}s)`);
    return entry.response;
}

function setCachedResult(username: string, persona: PersonaType, response: AnalysisResponse): void {
    const key = `${username.toLowerCase()}:${persona}`;
    analysisCache.set(key, { response, timestamp: Date.now() });
    console.log(`[Cache] STORED for: ${key} (total cached: ${analysisCache.size})`);
}

/**
 * Main pipeline: Rate Limit → Cache → GitHub Data → AI Analysis → Response
 */
export async function performAnalysis(
    username: string,
    persona: PersonaType = 'recruiter'
): Promise<AnalysisResponse> {
    // --- Rate Limit Check ---
    const headersList = await headers();
    const clientIP =
        headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        headersList.get("x-real-ip") ||
        "anonymous";

    const rateLimitResult = checkRateLimit(clientIP);
    if (!rateLimitResult.allowed) {
        const retrySeconds = Math.ceil((rateLimitResult.retryAfterMs || 0) / 1000);
        console.warn(`[RateLimit] BLOCKED: ${clientIP} (retry in ${retrySeconds}s)`);
        return {
            success: false,
            error: `Too many requests. Please wait ${retrySeconds} seconds before trying again.`,
        };
    }
    console.log(`[RateLimit] OK: ${clientIP} (${rateLimitResult.remaining} remaining)`);

    // --- Input Validation ---

    // Sanitize input to handle full URLs or raw usernames
    const cleanUsername = extractUsername(username);

    if (!cleanUsername) {
        return {
            success: false,
            error: "Please enter a valid GitHub username or profile URL.",
        };
    }

    const trimmedUsername = cleanUsername;

    // Basic GitHub username validation (alphanumeric + hyphens, 1-39 chars)
    // Double check just in case extractUsername missed something specific or if logic differs
    // extractUsername already executes regex validation, so this is just a safeguard
    if (trimmedUsername.length > 39) {
        return {
            success: false,
            error: "Username is too long.",
        };
    }

    // --- Step 0: Check Cache ---
    const cached = getCachedResult(trimmedUsername, persona);
    if (cached) {
        return cached;
    }

    try {
        // --- Step 1: Fetch GitHub Data ---
        console.log(`[Analysis] Fetching GitHub data for: ${trimmedUsername}`);
        const profileData = await fetchGitHubData(trimmedUsername);

        // --- Step 2: Run AI Analysis ---
        console.log(`[Analysis] Running AI analysis for: ${trimmedUsername} (persona: ${persona})`);
        const analysisResult = await analyzeProfile(profileData, persona);

        // --- Step 3: Return Combined Result ---
        console.log(`[Analysis] Complete for: ${trimmedUsername}`);
        const response: AnalysisResponse = {
            success: true,
            data: analysisResult,
            profileData,
        };

        // Cache successful result — but NOT mock/fallback data
        if (!analysisResult.isMockData) {
            setCachedResult(trimmedUsername, persona, response);
        } else {
            console.log(`[Cache] SKIPPED mock data for: ${trimmedUsername}`);
        }

        return response;
    } catch (error) {
        console.error(`[Analysis] Error for ${trimmedUsername}:`, error);

        // Provide user-friendly error messages
        const message =
            error instanceof Error ? error.message.toLowerCase() : "";

        // GitHub: User not found
        if (message.includes("not found") && !message.includes("model")) {
            return {
                success: false,
                error: `GitHub user "${trimmedUsername}" not found. Please check the username and try again.`,
            };
        }

        // GitHub: Rate limit
        if (
            message.includes("rate limit") &&
            !message.includes("quota")
        ) {
            return {
                success: false,
                error:
                    "GitHub API rate limit reached. Please try again in a few minutes.",
            };
        }

        // GitHub: Bad credentials
        if (message.includes("bad credentials")) {
            return {
                success: false,
                error:
                    "GitHub token is invalid. Please check your GITHUB_TOKEN in .env.local.",
            };
        }

        // AI: Missing API key
        if (message.includes("openrouter_api_key")) {
            return {
                success: false,
                error:
                    "AI service is not configured. Please add OPENROUTER_API_KEY to .env.local.",
            };
        }

        // Gemini: Quota / Rate limit (429)
        if (
            message.includes("429") ||
            message.includes("quota") ||
            message.includes("too many requests") ||
            message.includes("resource exhausted")
        ) {
            return {
                success: false,
                error:
                    "AI service rate limit reached. Please wait 1-2 minutes and try again. (Free tier has limited requests per minute.)",
            };
        }

        // Gemini: Model not found
        if (message.includes("model") && message.includes("not found")) {
            return {
                success: false,
                error:
                    "AI model configuration error. Please contact the administrator.",
            };
        }

        // Generic fallback — don't leak raw error messages
        return {
            success: false,
            error:
                "An unexpected error occurred during analysis. Please try again in a moment.",
        };
    }
}
