import OpenAI from "openai";
import type { AnalysisResult, GitHubProfileData } from "./types";
import { sanitizeProfileForAI } from "./sanitize";
import { getPersonaPrompt, type PersonaType } from "./personas";

// ============================================
// AI Analyzer (OpenRouter)
// ============================================

// --- SYSTEM PROMPT (Algorithmic Scoring Engine) ---
export const SYSTEM_PROMPT = `
You are a ruthless Scoring Algorithm, not a Recruiter. Do not "judge" based on potential. Calculate based on PROOF.

**ALGORITHMIC SCORING RULES (Follow Step-by-Step):**

**STEP 1: DETERMINE BASE SCORE (The Ceiling)**
- **User is a Student/Junior (based on bio):** START AT 60. (Max Cap: 85).
- **User is a Founder/Professional:** START AT 80. (Max Cap: 100).

**STEP 2: APPLY BONUSES (Proof of Engineering)**
- **+10 pts:** Has a repo with >50 stars OR a deployed "Production" app (not a demo).
- **+10 pts:** Usage of Advanced Tech: Docker, Kubernetes, AWS, GraphQL, or CI/CD workflows.
- **+5 pts:** Active in the last 7 days.

**STEP 3: APPLY PENALTIES (The "One-Hit Wonder" Filter)**
- **-15 pts (CRITICAL):** If the user has ONLY ONE complex repo (Tier 3) and the rest are Tier 1 (Calculators, To-Do, HTML), apply this penalty.
- **-10 pts:** If "Documentation" is weak (no architecture diagrams, just "npm install").
- **-10 pts:** If >50% of repos haven't been touched in 6 months. (Ignore this if User is Founder).

**STEP 4: FINAL CALCULATION**
(Base + Bonuses - Penalties).
- **HARD CAP:** If User is "Student" and has < 2 Tier 3 Repos, the Final Score CANNOT exceed 65.

**STEP 5: PRECISION RULE (CRITICAL)**
- Your total_score MUST be a PRECISE integer, NOT a round number.
- FORBIDDEN scores: 50, 60, 70, 80, 90. These are lazy and unacceptable.
- REQUIRED: Use specific values like 47, 53, 61, 67, 73, 78, 84, etc.
- For dimension scores (0-10): Use the FULL range. Scores of 5 and 7 for every dimension are lazy. Vary between 3, 4, 6, 7, 8, 9 based on actual evidence.

**OUTPUT JSON:**
{
  "total_score": number,
  "summary": "Write as a professional justification. Example: 'Base Score: 60 (Student Profile). No major technical bonuses detected. Code structure is decent, but lacks the complexity required for a Senior rating.'",
  "dimensions": {
    "documentation": { "score": 0-10, "comment": "Brief feedback on READMEs" },
    "code_structure": { "score": 0-10, "comment": "Feedback on repo organization" },
    "consistency": { "score": 0-10, "comment": "Based on 'updated_at' dates" },
    "impact": { "score": 0-10, "comment": "Does the project solve a real problem?" },
    "technical_depth": { "score": 0-10, "comment": "Complexity of languages/tools used" }
  },
  "recruiter_verdict": "Pass" | "Interview" | "Strong Hire",
  "actionable_feedback": ["3", "bullet", "points", "of", "specific", "fixes"]
}
`;

// --- CONFIG ---
const MAX_RETRIES = 2;
const BASE_DELAY_MS = 2000;

// --- MOCK DATA FOR DEMO MODE ---
const MOCK_ANALYSIS: AnalysisResult = {
    total_score: 72,
    summary:
        "Solid profile with clear engineering depth. Projects demonstrate architectural understanding and consistent contribution history.",
    dimensions: {
        documentation: { score: 8, comment: "READMEs are well-structured with demos and setup steps." },
        code_structure: { score: 7, comment: "Clean repo organization, though some legacy repos lack structure." },
        consistency: { score: 7, comment: "Consistent commit history over the past 6 months." },
        impact: { score: 6, comment: "Mix of portfolio projects and practice repos; some solve real problems." },
        technical_depth: { score: 8, comment: "Strong grasp of modern stack (Next.js, TypeScript, Cloud Infrastructure)." },
    },
    recruiter_verdict: "Interview",
    actionable_feedback: [
        "Archive or unpin low-quality forked repositories to focus on original work.",
        "Add CONTRIBUTING.md to major projects to encourage open source engagement.",
        "Update dependency chains on older projects to remove security alerts.",
    ],
};

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Extracts JSON from a response that might contain markdown code fences.
 */
function extractJSON(text: string): string {
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
        return jsonMatch[1].trim();
    }
    return text.trim();
}

/**
 * Sends GitHub profile data to AI for analysis via OpenRouter.
 * Uses sanitized, minimal payload to reduce token costs.
 */
export async function analyzeProfile(
    profileData: GitHubProfileData,
    persona: PersonaType = 'recruiter'
): Promise<AnalysisResult> {
    // --- DEMO MODE BYPASS ---
    if (
        profileData.user.login.toLowerCase() === "demo" ||
        profileData.user.login.toLowerCase() === "test" ||
        process.env.NEXT_PUBLIC_DEMO_MODE === "true"
    ) {
        console.log("[AI] DEMO MODE: Returning mock analysis.");
        await sleep(1500);
        return MOCK_ANALYSIS;
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
        throw new Error(
            "OPENROUTER_API_KEY is not set. Please add it to your .env.local file."
        );
    }

    const model = process.env.AI_MODEL || "openai/gpt-4o-mini";

    // --- SANITIZE DATA (token optimization) ---
    const rawPayload = JSON.stringify(profileData);
    const sanitized = sanitizeProfileForAI(profileData);
    const sanitizedPayload = JSON.stringify(sanitized);

    const rawSize = Buffer.byteLength(rawPayload, "utf-8");
    const cleanSize = Buffer.byteLength(sanitizedPayload, "utf-8");
    const reduction = Math.round((1 - cleanSize / rawSize) * 100);

    console.log(
        `[AI] Payload sanitized: ${(rawSize / 1024).toFixed(1)}kb → ${(cleanSize / 1024).toFixed(1)}kb (${reduction}% reduction)`
    );

    const userMessage = `Analyze this GitHub profile:\n\n${sanitizedPayload}`;

    // Initialize OpenAI client with OpenRouter base URL
    const client = new OpenAI({
        baseURL: "https://openrouter.ai/api/v1",
        apiKey: apiKey,
        defaultHeaders: {
            "HTTP-Referer": "http://localhost:3000",
            "X-Title": "GitHub Portfolio Analyzer",
        },
    });

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
            if (attempt > 0) {
                const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
                console.log(`[AI] Retry attempt ${attempt + 1} after ${delay}ms...`);
                await sleep(delay);
            }

            console.log(`[AI] Calling OpenRouter (${model}), persona: ${persona}, attempt ${attempt + 1}...`);

            const systemPrompt = getPersonaPrompt(persona);

            const completion = await client.chat.completions.create({
                model: model,
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userMessage },
                ],
                temperature: 0.4,  // Balanced: deterministic enough but allows granular scores
                max_tokens: 800,
                seed: 42,          // Fixed seed = same input → same output
            });

            const rawText = completion.choices[0]?.message?.content;
            if (!rawText) {
                throw new Error("Empty response from AI");
            }

            const cleanJSON = extractJSON(rawText);
            const parsed: AnalysisResult = JSON.parse(cleanJSON);

            // Validation
            if (
                typeof parsed.total_score !== "number" ||
                typeof parsed.summary !== "string" ||
                !parsed.dimensions ||
                !parsed.recruiter_verdict
            ) {
                throw new Error("Invalid response structure from AI");
            }

            parsed.total_score = Math.max(0, Math.min(100, Math.round(parsed.total_score)));
            if (!Array.isArray(parsed.actionable_feedback)) parsed.actionable_feedback = [];

            // Ensure all dimension scores are clamped 0-10
            const dims = parsed.dimensions;
            let calculatedTotal = 0;

            for (const key of ["documentation", "code_structure", "consistency", "impact", "technical_depth"] as const) {
                if (dims[key]) {
                    // Handle potential string numbers from AI
                    const rawDimScore = Number(dims[key].score);
                    dims[key].score = Math.max(0, Math.min(10, Math.round(Boolean(rawDimScore) ? rawDimScore : 0)));
                    calculatedTotal += dims[key].score;
                }
            }

            // ROBUST FIX: If total_score is 0 or missing, recalculate it from dimensions.
            // Max score = 5 dimensions * 10 points * 2 multiplier = 100.
            // If AI explicitly returned 0 but dimensions are non-zero, it likely hallucinated the total.
            const rawTotalScore = Number(parsed.total_score);
            if (!rawTotalScore || rawTotalScore === 0) {
                // Double the sum of dimensions to get percent (50 * 2 = 100)
                parsed.total_score = calculatedTotal * 2;
                console.log(`[AI] Recalculated total_score from dimensions: ${parsed.total_score}`);
            } else {
                parsed.total_score = Math.max(0, Math.min(100, Math.round(rawTotalScore)));
            }

            // Ensure verdict is valid
            if (!["Strong Hire", "Interview", "Pass"].includes(parsed.recruiter_verdict)) {
                parsed.recruiter_verdict = parsed.total_score >= 70 ? "Strong Hire" : parsed.total_score >= 45 ? "Interview" : "Pass";
            }

            console.log(`[AI] Success! Score: ${parsed.total_score}, Verdict: ${parsed.recruiter_verdict}`);
            return parsed;
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            console.warn(`[AI] Attempt ${attempt + 1} failed: ${lastError.message}`);
        }
    }

    // --- FINAL FALLBACK: AUTOMATIC DEMO MODE ---
    console.warn("[AI] All attempts failed. Falling back to MOCK DATA.");
    return {
        ...MOCK_ANALYSIS,
        isMockData: true,
        summary: `(System Note: Live analysis failed. Showing demo data.) ${MOCK_ANALYSIS.summary}`
    };
}
