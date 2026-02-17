"use server";

import { prisma } from "@/lib/prisma";
import { fetchGitHubData, fetchGitHubDataLite } from "@/lib/github";
import { analyzeProfile, compareProfiles } from "@/lib/gemini";
import { checkRateLimit } from "@/lib/rate-limit";
import { headers } from "next/headers";
import type { AnalysisResponse, DualAnalysisResult, CompareResponse } from "@/lib/types";
import { extractUsername } from "@/lib/utils";

// ============================================
// Server Action: The Connector
// ============================================

// --- IN-MEMORY CACHE ---
// Caches the FULL dual-persona result keyed by lowercase username.
// Each entry has a TTL (time-to-live) of 10 minutes.
// When a user switches personas, the cache serves the other view instantly.
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

interface DualCacheEntry {
    dualResult: DualAnalysisResult;
    profileData: Awaited<ReturnType<typeof fetchGitHubData>>;
    timestamp: number;
}

const dualCache = new Map<string, DualCacheEntry>();

function getCachedDual(username: string): DualCacheEntry | null {
    const key = username.toLowerCase();
    const entry = dualCache.get(key);

    if (!entry) return null;

    if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
        dualCache.delete(key);
        console.log(`[Cache] Expired for: ${key}`);
        return null;
    }

    console.log(`[Cache] HIT for: ${key} (age: ${Math.round((Date.now() - entry.timestamp) / 1000)}s)`);
    return entry;
}

function setCachedDual(
    username: string,
    dualResult: DualAnalysisResult,
    profileData: Awaited<ReturnType<typeof fetchGitHubData>>
): void {
    const key = username.toLowerCase();
    dualCache.set(key, { dualResult, profileData, timestamp: Date.now() });
    console.log(`[Cache] STORED dual result for: ${key} (total cached: ${dualCache.size})`);
}

/**
 * Main pipeline: Rate Limit → Cache → GitHub Data → AI Analysis → Unwrap by Persona → Response
 *
 * The AI returns BOTH recruiter and founder perspectives in a single call.
 * This function unwraps the selected persona and returns a single AnalysisResult.
 * Switching personas is instant (cache hit, zero extra tokens).
 */
export async function performAnalysis(
    username: string,
    persona: "recruiter" | "founder" = "recruiter"
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
    const cleanUsername = extractUsername(username);

    if (!cleanUsername) {
        return {
            success: false,
            error: "Please enter a valid GitHub username or profile URL.",
        };
    }

    const trimmedUsername = cleanUsername;

    if (trimmedUsername.length > 39) {
        return {
            success: false,
            error: "Username is too long.",
        };
    }

    // --- Step 0: Check Cache (serves both personas from one cached dual result) ---
    const cached = getCachedDual(trimmedUsername);
    if (cached) {
        const selectedAnalysis = cached.dualResult[persona];
        console.log(`[Cache] Returning ${persona} view (score: ${selectedAnalysis.total_score})`);
        return {
            success: true,
            data: selectedAnalysis,
            profileData: cached.profileData,
        };
    }

    try {
        // --- Step 1: Fetch GitHub Data ---
        console.log(`[Analysis] Fetching GitHub data for: ${trimmedUsername}`);
        const profileData = await fetchGitHubData(trimmedUsername);

        // --- Step 2: Run AI Analysis (returns BOTH personas in one call) ---
        console.log(`[Analysis] Running dual-persona AI analysis for: ${trimmedUsername}`);
        const dualResult = await analyzeProfile(profileData);

        // --- Step 3: Cache the full dual result ---
        if (!dualResult.recruiter.isMockData) {
            setCachedDual(trimmedUsername, dualResult, profileData);
        } else {
            console.log(`[Cache] SKIPPED mock data for: ${trimmedUsername}`);
        }

        // --- Step 4: Unwrap and return the selected persona ---
        const selectedAnalysis = dualResult[persona];
        console.log(`[Analysis] Complete for: ${trimmedUsername} (${persona}: ${selectedAnalysis.total_score})`);

        return {
            success: true,
            data: selectedAnalysis,
            profileData,
        };
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

        // AI: Quota / Rate limit (429)
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

        // AI: Model not found
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

// ============================================
// DevDuel: Compare Two Profiles
// ============================================

/**
 * Compare two GitHub profiles head-to-head.
 * Uses Promise.all to fetch both profiles concurrently.
 */
export async function performComparison(
    username1: string,
    username2: string,
    persona: "recruiter" | "founder" = "recruiter"
): Promise<CompareResponse> {
    // --- Rate Limit ---
    const headersList = await headers();
    const clientIP =
        headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        headersList.get("x-real-ip") ||
        "anonymous";

    const rateLimitResult = checkRateLimit(clientIP);
    if (!rateLimitResult.allowed) {
        const retrySeconds = Math.ceil((rateLimitResult.retryAfterMs || 0) / 1000);
        return {
            success: false,
            error: `Too many requests. Please wait ${retrySeconds} seconds.`,
        };
    }

    // --- Validate both usernames ---
    const clean1 = extractUsername(username1);
    const clean2 = extractUsername(username2);

    if (!clean1 || !clean2) {
        return {
            success: false,
            error: "Please enter valid GitHub usernames or profile URLs for both challengers.",
        };
    }

    if (clean1.toLowerCase() === clean2.toLowerCase()) {
        return {
            success: false,
            error: "You can't battle yourself! Enter two different usernames.",
        };
    }

    try {
        // --- Fetch profiles SEQUENTIALLY to avoid GitHub 429 rate limits ---
        console.log(`[DevDuel] Fetching profile 1: ${clean1}`);
        const profile1 = await fetchGitHubDataLite(clean1);

        console.log(`[DevDuel] Fetching profile 2: ${clean2}`);
        const profile2 = await fetchGitHubDataLite(clean2);

        if (!profile1 || !profile2) {
            throw new Error("One or both users not found");
        }

        // --- Run comparative AI analysis ---
        console.log(`[DevDuel] Running AI comparison: ${clean1} vs ${clean2} (${persona})`);
        const result = await compareProfiles(profile1, profile2, persona);

        console.log(`[DevDuel] Complete! Winner: ${result.winner}`);

        // SAVE TO DB (Fire & Forget)
        try {
            await prisma.battle.create({
                data: {
                    user1: clean1,
                    user2: clean2,
                    score1: result.user1_stats.score,
                    score2: result.user2_stats.score,
                    winner: result.winner === "user1" ? clean1 : clean2,
                    persona: persona,
                },
            });
            console.log(`[DevDuel] Battle saved to DB`);
        } catch (dbError) {
            console.error("[DevDuel] Database Save Failed:", dbError);
            // Do NOT throw — still show the user the result
        }

        return {
            success: true,
            data: result,
        };
    } catch (error: unknown) {
        // Phase 3: FAIL LOUDLY — return real error message, not fake data
        const message = error instanceof Error ? error.message : "Analysis Failed";
        console.error(`[DevDuel] Error:`, message);

        return {
            success: false,
            error: message,
        };
    }
}

