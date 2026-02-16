import OpenAI from "openai";
import type { AnalysisResult, DualAnalysisResult, GitHubProfileData } from "./types";
import { sanitizeProfileForAI } from "./sanitize";

// ============================================
// AI Analyzer (OpenRouter) — Dual Persona Mode
// ============================================

// --- DUAL PERSONA SYSTEM PROMPT ---
// Asks the AI to evaluate from BOTH perspectives in ONE response.
export const SYSTEM_PROMPT = `
You are a Dual-Persona Technical Auditor. You must analyze the candidate from TWO perspectives simultaneously.

**1. 🕵️ THE FAANG RECRUITER (Strict)**
   - **Priorities:** Unit Tests, TypeScript, CI/CD, Code Consistency.
   - **Scoring:** Cap at 60 if no tests. Cap at 70 if no Types/Linter.
   - **Tone:** Professional, objective, critical.

**2. 🚀 THE STARTUP FOUNDER (Pragmatic)**
   - **Priorities:** Shipping Speed, Live Deployments (Vercel/Netlify), "Hero Projects".
   - **Scoring:** +20 pts for ANY live deployment link. Forgives messy code if it works.
   - **Tone:** Energetic, blunt, focused on value.

**SHARED SCORING RULES:**

STEP 1: BASE SCORE
- Student/Junior: START AT 60. (Max Cap: 85).
- Founder/Professional: START AT 80. (Max Cap: 100).

STEP 2: BONUSES
- +10 pts: Repo with >50 stars OR deployed production app.
- +10 pts: Advanced Tech (Docker, K8s, AWS, GraphQL, CI/CD).
- +5 pts: Active in last 7 days.

STEP 3: PENALTIES
- -15 pts: Only ONE complex repo, rest are tutorials.
- -10 pts: Weak documentation (just "npm install").
- -10 pts: >50% repos untouched 6 months.

STEP 4: PRECISION RULE (CRITICAL)
- total_score MUST be a PRECISE integer. FORBIDDEN: 50, 60, 70, 80, 90.
- REQUIRED: values like 47, 53, 61, 67, 73, 78, 84.
- The recruiter and founder scores MUST BE DIFFERENT.
- Dimension scores (0-10): Use the FULL range.

**OUTPUT JSON FORMAT (STRICT — no markdown, no backticks):**
{
  "recruiter": {
    "total_score": number,
    "summary": "Professional justification from FAANG recruiter...",
    "role_fit": "Junior Dev" | "Mid-Level" | "Senior Engineer" | "Staff+",
    "dimensions": {
      "documentation": { "score": 0-10, "comment": "..." },
      "code_structure": { "score": 0-10, "comment": "..." },
      "consistency": { "score": 0-10, "comment": "..." },
      "impact": { "score": 0-10, "comment": "..." },
      "technical_depth": { "score": 0-10, "comment": "..." }
    },
    "recruiter_verdict": "Pass" | "Interview" | "Strong Hire",
    "actionable_feedback": ["...", "...", "..."]
  },
  "founder": {
    "total_score": number,
    "summary": "Blunt justification from YC founder...",
    "role_fit": "Not Ready" | "Intern Material" | "Indie Hacker" | "Founding Engineer",
    "dimensions": {
      "documentation": { "score": 0-10, "comment": "..." },
      "code_structure": { "score": 0-10, "comment": "..." },
      "consistency": { "score": 0-10, "comment": "..." },
      "impact": { "score": 0-10, "comment": "..." },
      "technical_depth": { "score": 0-10, "comment": "..." }
    },
    "recruiter_verdict": "Pass" | "Interview" | "Strong Hire",
    "actionable_feedback": ["...", "...", "..."]
  }
}
`;

// --- CONFIG ---
const MAX_RETRIES = 2;
const BASE_DELAY_MS = 2000;

// --- MOCK DATA FOR DEMO MODE ---
const MOCK_DUAL: DualAnalysisResult = {
    recruiter: {
        total_score: 57,
        summary: "Candidate shows foundational understanding of modern web technologies but lacks production-grade engineering signals. No test suites, no CI/CD pipelines, and documentation is surface-level. Would need significant mentorship.",
        role_fit: "Junior Dev",
        dimensions: {
            documentation: { score: 4, comment: "READMEs are install-only. No architecture context or design rationale." },
            code_structure: { score: 6, comment: "Reasonable folder structure but no evidence of design patterns or abstractions." },
            consistency: { score: 5, comment: "Sporadic commit frequency with multi-week gaps." },
            impact: { score: 4, comment: "Portfolio projects only. No evidence of real-world users or problem-solving." },
            technical_depth: { score: 7, comment: "Competent with Next.js and TypeScript. Missing backend and infrastructure depth." },
        },
        recruiter_verdict: "Interview",
        actionable_feedback: [
            "Add Jest/Vitest tests to at least one project — this alone would boost your score by 10+ points.",
            "Set up GitHub Actions CI/CD to demonstrate DevOps awareness.",
            "Expand READMEs with architecture decisions, not just setup instructions.",
        ],
    },
    founder: {
        total_score: 73,
        summary: "This person ships. Multiple finished projects, some with live deployment links. Not overthinking it — just building. Exactly the mentality a seed-stage startup needs.",
        role_fit: "Indie Hacker",
        dimensions: {
            documentation: { score: 6, comment: "Good enough to onboard someone quickly. Functional, not fancy." },
            code_structure: { score: 5, comment: "Scrappy but it works. Not enterprise-grade, but who cares at this stage." },
            consistency: { score: 7, comment: "Regular commits show a builder mentality. Keeps iterating." },
            impact: { score: 8, comment: "Deployed apps that solve real problems. User-centric thinking." },
            technical_depth: { score: 6, comment: "Pragmatic stack choices. Ships with Next.js, doesn't overthink." },
        },
        recruiter_verdict: "Interview",
        actionable_feedback: [
            "Add Google Analytics to deployed apps and showcase real user numbers.",
            "Build one project with payments or auth to prove full-stack chops.",
            "Write a 'How I Built This' blog post to flex product thinking.",
        ],
    },
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
 * Validates and clamps a single AnalysisResult.
 */
function validateAnalysis(parsed: AnalysisResult): AnalysisResult {
    parsed.total_score = Math.max(0, Math.min(100, Math.round(parsed.total_score || 0)));
    if (!Array.isArray(parsed.actionable_feedback)) parsed.actionable_feedback = [];

    const dims = parsed.dimensions;
    let calculatedTotal = 0;

    for (const key of ["documentation", "code_structure", "consistency", "impact", "technical_depth"] as const) {
        if (dims[key]) {
            const rawDimScore = Number(dims[key].score);
            dims[key].score = Math.max(0, Math.min(10, Math.round(Boolean(rawDimScore) ? rawDimScore : 0)));
            calculatedTotal += dims[key].score;
        }
    }

    const rawTotalScore = Number(parsed.total_score);
    if (!rawTotalScore || rawTotalScore === 0) {
        parsed.total_score = calculatedTotal * 2;
    } else {
        parsed.total_score = Math.max(0, Math.min(100, Math.round(rawTotalScore)));
    }

    if (!["Strong Hire", "Interview", "Pass"].includes(parsed.recruiter_verdict)) {
        parsed.recruiter_verdict = parsed.total_score >= 70 ? "Strong Hire" : parsed.total_score >= 45 ? "Interview" : "Pass";
    }

    return parsed;
}

/**
 * Sends GitHub profile data to AI for analysis via OpenRouter.
 * Returns BOTH recruiter and founder perspectives in a single call.
 */
export async function analyzeProfile(
    profileData: GitHubProfileData
): Promise<DualAnalysisResult> {
    // --- DEMO MODE BYPASS ---
    if (
        profileData.user.login.toLowerCase() === "demo" ||
        profileData.user.login.toLowerCase() === "test" ||
        process.env.NEXT_PUBLIC_DEMO_MODE === "true"
    ) {
        console.log("[AI] DEMO MODE: Returning mock dual analysis.");
        await sleep(1500);
        return MOCK_DUAL;
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

    const userMessage = `Analyze this GitHub profile from BOTH perspectives (recruiter AND founder). Return a single JSON with both:\n\n${sanitizedPayload}`;

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

            console.log(`[AI] Calling OpenRouter (${model}), DUAL PERSONA mode, attempt ${attempt + 1}...`);

            const completion = await client.chat.completions.create({
                model: model,
                messages: [
                    { role: "system", content: SYSTEM_PROMPT },
                    { role: "user", content: userMessage },
                ],
                temperature: 0.4,
                max_tokens: 1500, // Increased for dual output
                seed: 42,
            });

            const rawText = completion.choices[0]?.message?.content;
            if (!rawText) {
                throw new Error("Empty response from AI");
            }

            const cleanJSON = extractJSON(rawText);
            const parsed: DualAnalysisResult = JSON.parse(cleanJSON);

            // Validate both sides exist
            if (!parsed.recruiter || !parsed.founder) {
                throw new Error("AI did not return both recruiter and founder perspectives");
            }

            // Validate and clamp both
            parsed.recruiter = validateAnalysis(parsed.recruiter);
            parsed.founder = validateAnalysis(parsed.founder);

            console.log(`[AI] Success! Recruiter: ${parsed.recruiter.total_score}, Founder: ${parsed.founder.total_score}`);
            return parsed;
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            console.warn(`[AI] Attempt ${attempt + 1} failed: ${lastError.message}`);
        }
    }

    // --- FINAL FALLBACK ---
    console.warn("[AI] All attempts failed. Falling back to MOCK DATA.");
    return {
        recruiter: {
            ...MOCK_DUAL.recruiter,
            isMockData: true,
            summary: `(System Note: Live analysis failed. Showing demo data.) ${MOCK_DUAL.recruiter.summary}`
        },
        founder: {
            ...MOCK_DUAL.founder,
            isMockData: true,
            summary: `(System Note: Live analysis failed. Showing demo data.) ${MOCK_DUAL.founder.summary}`
        },
    };
}
