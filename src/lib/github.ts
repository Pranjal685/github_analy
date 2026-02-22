import { Octokit } from "@octokit/rest";
import type { GitHubProfileData, GitHubRepo, GitHubUser } from "./types";

// ============================================
// GitHub Data Fetcher
// ============================================

const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN,
});

/**
 * Fetches the raw README.md content for a given repository.
 * Returns null if no README exists or an error occurs.
 */
async function fetchReadmeContent(
    owner: string,
    repo: string
): Promise<string | null> {
    try {
        const { data } = await octokit.repos.getReadme({
            owner,
            repo,
            mediaType: { format: "raw" },
        });
        // When using raw format, data is returned as a string
        return data as unknown as string;
    } catch (error) {
        // Cast error to check status safely
        const err = error as { status?: number; message?: string };
        if (err.status === 404) {
            // Repo has no README, ignore properly
            return null;
        }
        // Log other errors (rate limits, 500s) as warnings
        console.warn(`[GitHub] Failed to fetch README for ${owner}/${repo}:`, err.message || String(error));
        return null;
    }
}

/**
 * Fetches comprehensive GitHub profile data for a given username.
 *
 * Pipeline:
 * 1. Fetch user profile info
 * 2. Fetch top 6 repos (sorted by most recently updated)
 * 3. For each repo, fetch the README.md content
 * 4. Return consolidated GitHubProfileData object
 */
export async function fetchGitHubData(
    username: string
): Promise<GitHubProfileData> {
    // --- Step 1: Fetch User Profile ---
    const { data: rawUser } = await octokit.users.getByUsername({
        username,
    });

    const user: GitHubUser = {
        login: rawUser.login,
        name: rawUser.name ?? null,
        bio: rawUser.bio ?? null,
        avatar_url: rawUser.avatar_url,
        html_url: rawUser.html_url,
        company: rawUser.company ?? null,
        location: rawUser.location ?? null,
        blog: rawUser.blog ?? null,
        twitter_username: rawUser.twitter_username ?? null,
        followers: rawUser.followers,
        following: rawUser.following,
        public_repos: rawUser.public_repos,
        public_gists: rawUser.public_gists,
        created_at: rawUser.created_at,
        updated_at: rawUser.updated_at,
    };

    // --- Step 2: Fetch 30 Repositories (broad pool) ---
    const { data: rawRepos } = await octokit.repos.listForUser({
        username,
        sort: "updated",
        direction: "desc",
        per_page: 30,
        type: "owner", // Only repos they own, not forks they haven't modified
    });

    // --- Step 3: SMART SORT ALGORITHM ---
    // Rank repos by "Impact" instead of just recency.
    // Prioritize: Stars > Original Work > Has Description > Has Topics
    const sortedRepos = rawRepos
        .map((repo) => ({
            ...repo,
            _relevance:
                (repo.stargazers_count ?? 0) * 5    // High weight for stars
                + (!repo.fork ? 10 : 0)             // Bonus for original work
                + (repo.description ? 5 : 0)        // Bonus for description
                + ((repo.topics?.length ?? 0) > 0 ? 3 : 0) // Bonus for topics
        }))
        .sort((a, b) => b._relevance - a._relevance)
        .slice(0, 6); // Keep only the Top 6 BEST repos

    console.log(`[GitHub] Smart Sort: Selected ${sortedRepos.map(r => `${r.name}(★${r.stargazers_count})`).join(', ')}`);

    // --- Step 4: Fetch README for each repo (in parallel) ---
    const repos: GitHubRepo[] = await Promise.all(
        sortedRepos.map(async (repo) => {
            const readmeContent = await fetchReadmeContent(username, repo.name);

            return {
                name: repo.name,
                full_name: repo.full_name,
                html_url: repo.html_url,
                description: repo.description ?? null,
                language: repo.language ?? null,
                stargazers_count: repo.stargazers_count ?? 0,
                forks_count: repo.forks_count ?? 0,
                watchers_count: repo.watchers_count ?? 0,
                open_issues_count: repo.open_issues_count ?? 0,
                topics: repo.topics ?? [],
                created_at: repo.created_at ?? "",
                updated_at: repo.updated_at ?? "",
                pushed_at: repo.pushed_at ?? "",
                homepage: repo.homepage ?? null,
                fork: repo.fork ?? false,
                has_wiki: repo.has_wiki ?? false,
                has_pages: repo.has_pages ?? false,
                license: repo.license
                    ? { name: repo.license.name ?? "", spdx_id: repo.license.spdx_id ?? "" }
                    : null,
                readme_content: readmeContent,
            } satisfies GitHubRepo;
        })
    );

    // --- Step 4: Return consolidated data ---
    return {
        user,
        repos,
        fetchedAt: new Date().toISOString(),
    };
}

// ============================================
// GitHub Content API (Deep Scan)
// ============================================

const MAX_FILE_CHARS = 3000;

/**
 * Fetches a specific file's content from a GitHub repo.
 * Returns decoded UTF-8 string, truncated to MAX_FILE_CHARS.
 * Returns null if file doesn't exist (404).
 */
export async function getRepoFileContent(
    username: string,
    repoName: string,
    filePath: string
): Promise<string | null> {
    try {
        const res = await fetch(
            `https://api.github.com/repos/${username}/${repoName}/contents/${filePath}`,
            {
                headers: {
                    Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
                    Accept: "application/vnd.github.v3+json",
                },
            }
        );
        if (!res.ok) return null;
        const data = await res.json();
        if (data.encoding !== "base64" || !data.content) return null;

        const decoded = Buffer.from(data.content, "base64").toString("utf-8");
        return decoded.length > MAX_FILE_CHARS
            ? decoded.slice(0, MAX_FILE_CHARS) + "\n[...TRUNCATED]"
            : decoded;
    } catch {
        return null;
    }
}

// ============================================
// Lightweight Fetch for DevDuel Compare Mode
// ============================================

/**
 * Lightweight profile fetch for DevDuel comparisons.
 * - Top 15 repos by stars (no README fetching)
 * - Minimal repo payload to stay within AI context window
 * - ~10x smaller than full fetchGitHubData
 */
export async function fetchGitHubDataLite(
    username: string
): Promise<GitHubProfileData> {
    // --- Step 1: Fetch User Profile ---
    const { data: rawUser } = await octokit.users.getByUsername({ username });

    const user: GitHubUser = {
        login: rawUser.login,
        name: rawUser.name ?? null,
        bio: rawUser.bio ?? null,
        avatar_url: rawUser.avatar_url,
        html_url: rawUser.html_url,
        company: rawUser.company ?? null,
        location: rawUser.location ?? null,
        blog: rawUser.blog ?? null,
        twitter_username: rawUser.twitter_username ?? null,
        followers: rawUser.followers,
        following: rawUser.following,
        public_repos: rawUser.public_repos,
        public_gists: rawUser.public_gists,
        created_at: rawUser.created_at,
        updated_at: rawUser.updated_at,
    };

    // --- Step 2: Fetch repos, sort by stars, take top 15 ---
    const { data: rawRepos } = await octokit.repos.listForUser({
        username,
        sort: "updated",
        direction: "desc",
        per_page: 30,
        type: "owner",
    });

    const topRepos = rawRepos
        .sort((a, b) => (b.stargazers_count ?? 0) - (a.stargazers_count ?? 0))
        .slice(0, 15) // CRITICAL: Hard limit to prevent AI context overflow
        .map((r) => ({
            name: r.name,
            full_name: r.full_name,
            html_url: r.html_url,
            description: r.description ?? null,
            language: r.language ?? null,
            stargazers_count: r.stargazers_count ?? 0,
            forks_count: r.forks_count ?? 0,
            watchers_count: r.watchers_count ?? 0,
            open_issues_count: r.open_issues_count ?? 0,
            topics: r.topics ?? [],
            created_at: r.created_at ?? "",
            updated_at: r.updated_at ?? "",
            pushed_at: r.pushed_at ?? "",
            homepage: r.homepage ?? null,
            fork: r.fork ?? false,
            has_wiki: r.has_wiki ?? false,
            has_pages: r.has_pages ?? false,
            license: r.license
                ? { name: r.license.name ?? "", spdx_id: r.license.spdx_id ?? "" }
                : null,
            readme_content: null, // SKIPPED — too expensive for compare mode
        } satisfies GitHubRepo));

    console.log(
        `[GitHub-Lite] ${username}: Top ${topRepos.length} repos by stars → ${topRepos.map(r => `${r.name}(★${r.stargazers_count})`).join(', ')}`
    );

    // --- Step 3: Deep Scan — fetch README + package.json from #1 repo ---
    let deep_scan: { top_repo_name: string; readme: string | null; package_json: string | null } | undefined;
    if (topRepos.length > 0) {
        const topRepo = topRepos[0];
        const [readme, pkg] = await Promise.all([
            getRepoFileContent(username, topRepo.name, "README.md"),
            getRepoFileContent(username, topRepo.name, "package.json"),
        ]);
        deep_scan = { top_repo_name: topRepo.name, readme, package_json: pkg };
        console.log(`[Deep Scan] ${username}/${topRepo.name}: README=${readme ? 'YES' : 'NO'}, package.json=${pkg ? 'YES' : 'NO'}`);
    }

    return {
        user,
        repos: topRepos,
        deep_scan,
        fetchedAt: new Date().toISOString(),
    };
}

