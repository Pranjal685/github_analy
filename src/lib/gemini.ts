import OpenAI from "openai";
import { unstable_cache } from "next/cache";
import type { AnalysisResult, DualAnalysisResult, GitHubProfileData, CompareResult } from "./types";
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

// ============================================
// DevDuel — Comparative Analysis (Referee Mode)
// ============================================

// Weighted Category Scoring System
const COMPARE_SYSTEM_PROMPT = `
ROLE: Technical Referee with Deep Code Analysis.
TASK: Compare Candidate A vs Candidate B using BOTH metadata AND actual code artifacts.

--------------------------------------------------------
SCORING ALGORITHM (WEIGHTED SUM):

You must score each candidate across 5 dimensions. Sum them to get the Total Score.
*CRITICAL: Do not use round numbers. Use integers like 23, 17, 8, etc.*

### IF PERSONA = "RECRUITER" (Strict & Corporate)
1. **Architecture & Clean Code (Max 30pts):** Are repos organized? No spaghetti code?
2. **Type Safety & Languages (Max 25pts):** Reward TypeScript/Rust/Go. Penalize loose JS/Python.
3. **Testing & CI/CD (Max 20pts):** Presence of Jest/Vitest and .github/workflows.
4. **Documentation (Max 15pts):** README quality, setup guides.
5. **Consistency (Max 10pts):** Regular commit history vs gaps.

### IF PERSONA = "FOUNDER" (Fast & Product-Led)
1. **Shipping & Live Links (Max 30pts):** Vercel/Netlify/AppStore links = High Score.
2. **Product Complexity (Max 25pts):** DB+Auth+UI > Static Landing Pages.
3. **Velocity (Max 20pts):** High activity in the last 7-14 days.
4. **Traction/Stars (Max 15pts):** Social proof (Stars/Forks).
5. **"Founder Vibe" (Max 10pts):** Cool bio, interesting projects, unique personality.

### DEEP SCAN BONUS/PENALTY:
- If a **package.json** is provided, analyze dependencies. Award bonus for Modern Stack (TypeScript, Tailwind, Prisma, NextAuth, Docker, tRPC, Zod, Vitest, etc.). Penalize for outdated or trivial setups (only create-react-app defaults, no linter/testing).
- If a **README.md** is provided, reward detailed architecture docs, setup guides, and screenshots. Penalize default/boilerplate READMEs (e.g., "This project was bootstrapped with Create React App").
- Deep Scan analysis should influence the total score by up to ±8 points.

--------------------------------------------------------
CRITICAL SCORING RULE:
The sum of all categories MUST NOT exceed 100.
If your calculated sum is 115, you MUST cap it at 100.

CRITICAL RULES:
1. Candidate A's stats must come ONLY from Candidate A's data block.
2. Candidate B's stats must come ONLY from Candidate B's data block.
3. Do NOT invent repos. Only reference repos that exist in the provided data.
4. top_repo must be a real repo name from the candidate's data.
5. deep_scan_insights MUST reference actual dependencies or README content from the DEEP SCAN data.

OUTPUT JSON SCHEMA (STRICT — no markdown, no backticks):
{
  "winner": "user1" | "user2",
  "winner_reason": "Detailed explanation citing specific category differences.",
  "head_to_head": {
    "velocity": "user1" | "user2",
    "quality": "user1" | "user2",
    "impact": "user1" | "user2"
  },
  "user1_stats": { "score": number, "top_repo": "string" },
  "user2_stats": { "score": number, "top_repo": "string" },
  "deep_scan_insights": {
    "user1_insight": "One sentence analyzing their top repo's code/dependencies/README quality.",
    "user2_insight": "One sentence analyzing their top repo's code/dependencies/README quality."
  }
}
`;

const MOCK_COMPARE: CompareResult = {
    winner: "user1",
    winner_reason: "Candidate A has stronger documentation, more consistent commit history, and demonstrates CI/CD awareness across multiple repos.",
    head_to_head: {
        velocity: "user2",
        quality: "user1",
        impact: "user1",
    },
    user1_stats: { score: 73, top_repo: "portfolio-analyzer" },
    user2_stats: { score: 61, top_repo: "todo-app" },
    user1_username: "demo1",
    user2_username: "demo2",
    deep_scan_insights: {
        user1_insight: "Strong modern stack: Next.js, TypeScript, Prisma, and Tailwind detected in package.json. README includes architecture diagrams.",
        user2_insight: "Basic CRA setup with no custom dependencies. README is default boilerplate.",
    },
};

/**
 * Raw AI comparison (not cached).
 * Called by the cached wrapper below.
 */
async function _compareProfilesRaw(
    user1Data: GitHubProfileData,
    user2Data: GitHubProfileData,
    persona: "recruiter" | "founder"
): Promise<CompareResult> {
    const u1 = user1Data.user.login;
    const u2 = user2Data.user.login;

    // --- DEMO MODE ---
    if (
        process.env.NEXT_PUBLIC_DEMO_MODE === "true" ||
        u1.toLowerCase() === "demo" ||
        u2.toLowerCase() === "demo"
    ) {
        console.log("[Compare] DEMO MODE: Returning mock comparison.");
        await sleep(1500);
        return { ...MOCK_COMPARE, user1_username: u1, user2_username: u2 };
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
        throw new Error("OPENROUTER_API_KEY is not set.");
    }

    const model = process.env.AI_MODEL || "openai/gpt-4o-mini";

    // Build strict data-isolated prompt (Phase 2)
    const repos1 = user1Data.repos.map(r => ({
        name: r.name, stars: r.stargazers_count, description: r.description, language: r.language, updated_at: r.updated_at
    }));
    const repos2 = user2Data.repos.map(r => ({
        name: r.name, stars: r.stargazers_count, description: r.description, language: r.language, updated_at: r.updated_at
    }));

    const modeLabel = persona === "recruiter" ? "FAANG Recruiter" : "YC Founder";

    // Build deep scan blocks
    const ds1 = user1Data.deep_scan;
    const deepScanBlock1 = ds1 ? `
--- DEEP SCAN: ${ds1.top_repo_name} ---
README.md:
${ds1.readme || "[NOT FOUND]"}

package.json:
${ds1.package_json || "[NOT FOUND]"}
` : "";

    const ds2 = user2Data.deep_scan;
    const deepScanBlock2 = ds2 ? `
--- DEEP SCAN: ${ds2.top_repo_name} ---
README.md:
${ds2.readme || "[NOT FOUND]"}

package.json:
${ds2.package_json || "[NOT FOUND]"}
` : "";

    const userMessage = `
=== DATA SOURCE: CANDIDATE A (${u1}) ===
BIO: ${user1Data.user.bio || "No bio"}
REPOS: ${JSON.stringify(repos1)}
${deepScanBlock1}
=== DATA SOURCE: CANDIDATE B (${u2}) ===
BIO: ${user2Data.user.bio || "No bio"}
REPOS: ${JSON.stringify(repos2)}
${deepScanBlock2}
Evaluate as a ${modeLabel}. Use "user1" for ${u1} and "user2" for ${u2} in your output.`;

    const client = new OpenAI({
        baseURL: "https://openrouter.ai/api/v1",
        apiKey: apiKey,
        defaultHeaders: {
            "HTTP-Referer": "http://localhost:3000",
            "X-Title": "GitHub Portfolio Analyzer - DevDuel",
        },
    });

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
            if (attempt > 0) {
                const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
                console.log(`[Compare] Retry attempt ${attempt + 1} after ${delay}ms...`);
                await sleep(delay);
            }

            console.log(`[Compare] Calling OpenRouter (${model}), ${modeLabel} mode, attempt ${attempt + 1}...`);

            const completion = await client.chat.completions.create({
                model: model,
                messages: [
                    { role: "system", content: COMPARE_SYSTEM_PROMPT },
                    { role: "user", content: userMessage },
                ],
                temperature: 0.4,
                max_tokens: 1200,
                seed: 42,
            });

            const rawText = completion.choices[0]?.message?.content;
            if (!rawText) {
                throw new Error("Empty response from AI");
            }

            const cleanJSON = extractJSON(rawText);
            const parsed = JSON.parse(cleanJSON) as CompareResult;

            // Validate required fields
            if (!parsed.winner || !parsed.head_to_head || !parsed.user1_stats || !parsed.user2_stats) {
                throw new Error("AI response missing required comparison fields");
            }

            // Step 2: Code-level score clamping (0-100)
            const clamp = (n: number) => Math.min(100, Math.max(0, Math.round(n)));
            parsed.user1_stats.score = clamp(parsed.user1_stats.score);
            parsed.user2_stats.score = clamp(parsed.user2_stats.score);

            // Attach usernames
            parsed.user1_username = u1;
            parsed.user2_username = u2;

            console.log(`[Compare] Success! Winner: ${parsed.winner} (${u1}: ${parsed.user1_stats.score}, ${u2}: ${parsed.user2_stats.score})`);
            return parsed;
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            console.warn(`[Compare] Attempt ${attempt + 1} failed: ${lastError.message}`);
        }
    }

    // Phase 3: FAIL LOUDLY — no more mock fallback
    throw lastError || new Error("AI comparison failed after all retries");
}

/**
 * Cached wrapper for compareProfiles.
 * Alphabetically sorts usernames so A-vs-B === B-vs-A.
 * Cache is persona-specific with 24h revalidation.
 */
export const compareProfiles = async (
    user1Data: GitHubProfileData,
    user2Data: GitHubProfileData,
    persona: "recruiter" | "founder"
): Promise<CompareResult> => {
    const u1 = user1Data.user.login.toLowerCase();
    const u2 = user2Data.user.login.toLowerCase();

    // Sort alphabetically so shadcn-vs-pranjal === pranjal-vs-shadcn
    const sortedUsernames = [u1, u2].sort();
    const cacheKey = `battle-${sortedUsernames[0]}-${sortedUsernames[1]}-${persona}`;

    console.log(`[Compare Cache] Key: ${cacheKey}`);

    const getCachedBattle = unstable_cache(
        async () => {
            return await _compareProfilesRaw(user1Data, user2Data, persona);
        },
        [cacheKey],
        {
            revalidate: 86400, // 24 hours
            tags: [`battle-${sortedUsernames[0]}-${sortedUsernames[1]}`],
        }
    );

    return await getCachedBattle();
};
