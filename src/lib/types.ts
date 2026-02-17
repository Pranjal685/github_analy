// ============================================
// GitHub Portfolio Analyzer - Type Definitions
// ============================================

// --- GitHub Data Types ---

export interface GitHubUser {
    login: string;
    name: string | null;
    bio: string | null;
    avatar_url: string;
    html_url: string;
    company: string | null;
    location: string | null;
    blog: string | null;
    twitter_username: string | null;
    followers: number;
    following: number;
    public_repos: number;
    public_gists: number;
    created_at: string;
    updated_at: string;
}

export interface GitHubRepo {
    name: string;
    full_name: string;
    html_url: string;
    description: string | null;
    language: string | null;
    stargazers_count: number;
    forks_count: number;
    watchers_count: number;
    open_issues_count: number;
    topics: string[];
    created_at: string;
    updated_at: string;
    pushed_at: string;
    homepage: string | null;
    fork: boolean;
    has_wiki: boolean;
    has_pages: boolean;
    license: {
        name: string;
        spdx_id: string;
    } | null;
    readme_content: string | null; // Raw README.md text
}

export interface GitHubProfileData {
    user: GitHubUser;
    repos: GitHubRepo[];
    fetchedAt: string; // ISO timestamp of when data was fetched
}

// --- AI Analysis Types ---

export interface DimensionScore {
    score: number; // 0-10
    comment: string;
}

export interface AnalysisResult {
    total_score: number; // 0-100
    score?: number; // Fallback for legacy/hallucinated responses
    summary: string;
    role_fit: string; // e.g., "Junior Dev", "Indie Hacker", "Senior Engineer"
    dimensions: {
        documentation: DimensionScore;
        code_structure: DimensionScore;
        consistency: DimensionScore;
        impact: DimensionScore;
        technical_depth: DimensionScore;
    };
    recruiter_verdict: "Strong Hire" | "Interview" | "Pass";
    actionable_feedback: string[];
    isMockData?: boolean; // true when falling back to demo data
}

/** Both persona results from a single AI call */
export interface DualAnalysisResult {
    recruiter: AnalysisResult;
    founder: AnalysisResult;
}

// --- Server Action Response ---

export interface AnalysisResponse {
    success: boolean;
    data?: AnalysisResult;
    profileData?: GitHubProfileData;
    error?: string;
}

// --- DevDuel Compare Types ---

export interface UserStats {
    score: number;
    top_repo: string;
}

export interface CompareResult {
    winner: string; // username of winner, or "tie"
    winner_reason: string;
    head_to_head: {
        velocity: string;
        quality: string;
        impact: string;
    };
    user1_stats: UserStats;
    user2_stats: UserStats;
    user1_username: string;
    user2_username: string;
}

export interface CompareResponse {
    success: boolean;
    data?: CompareResult;
    error?: string;
}

