import { performAnalysis } from "@/app/actions";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AnimatedScore, AnimatedProgressBar } from "@/components/animated-score";
import {
    AlertTriangle,
    FileText,
    Star,
    GitFork,
    ArrowLeft,
    ExternalLink,
    MapPin,
    Building2,
    Calendar,
    Users,
    Wrench,
    BookOpen,
    FolderTree,
    Activity,
    Rocket,
    Cpu,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

interface ReportPageProps {
    params: Promise<{ username: string }>;
    searchParams: Promise<{ persona?: string }>;
}

export default async function ReportPage({ params, searchParams }: ReportPageProps) {
    const { username } = await params;
    const { persona: rawPersona } = await searchParams;
    const persona: "recruiter" | "founder" = rawPersona === "founder" ? "founder" : "recruiter";
    const result = await performAnalysis(username, persona);

    // --- Error State ---
    if (!result.success || !result.data || !result.profileData) {
        return (
            <main className="relative min-h-screen flex items-center justify-center px-4">
                <div className="max-w-md w-full space-y-4">
                    <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Analysis Failed</AlertTitle>
                        <AlertDescription>{result.error}</AlertDescription>
                    </Alert>
                    <Link href="/">
                        <Button variant="outline" className="w-full">
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Try Another Username
                        </Button>
                    </Link>
                </div>
            </main>
        );
    }

    const { data: analysis, profileData } = result;
    const { user, repos } = profileData;

    // Score color logic
    const scoreVal = analysis.total_score || 0;
    const scoreColor =
        scoreVal < 50 ? "red" : scoreVal < 80 ? "yellow" : "green";
    const scoreBarClass =
        scoreVal < 50
            ? "score-bar-red"
            : scoreVal < 80
                ? "score-bar-yellow"
                : "score-bar-green";

    // Verdict styling
    const verdictVariant =
        analysis.recruiter_verdict === "Strong Hire"
            ? "success" as const
            : analysis.recruiter_verdict === "Interview"
                ? "warning" as const
                : "destructive" as const;

    // Account age
    const createdDate = new Date(user.created_at);
    const accountAge = Math.floor(
        (Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24 * 365)
    );

    // Persona toggle links (instant switch via cache)
    const otherPersona = persona === "recruiter" ? "founder" : "recruiter";

    return (
        <main className="relative min-h-screen p-4 md:p-8">
            <div className="max-w-5xl mx-auto space-y-6">
                {/* Back Button */}
                <Link href="/">
                    <Button variant="ghost" size="sm" className="mb-2">
                        <ArrowLeft className="h-4 w-4 mr-1" />
                        New Scan
                    </Button>
                </Link>

                {/* ====== HEADER: User Profile ====== */}
                <div className="animate-fade-in-up">
                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
                                {/* Avatar */}
                                <div className="relative shrink-0">
                                    <Image
                                        src={user.avatar_url}
                                        alt={user.login}
                                        width={88}
                                        height={88}
                                        className="rounded-xl border-2 border-white/10"
                                    />
                                    <div
                                        className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-[#0a0a0f] ${scoreColor === "green"
                                            ? "bg-emerald-400"
                                            : scoreColor === "yellow"
                                                ? "bg-yellow-400"
                                                : "bg-red-400"
                                            }`}
                                    />
                                </div>

                                {/* Info */}
                                <div className="flex-1 text-center sm:text-left space-y-2 min-w-0">
                                    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                                        <h1 className="text-2xl md:text-3xl font-bold text-foreground truncate">
                                            {user.name || user.login}
                                        </h1>
                                        <a
                                            href={user.html_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 text-sm md:text-base text-cyan-400 hover:text-cyan-300 transition-colors"
                                        >
                                            @{user.login}
                                            <ExternalLink className="h-3 w-3" />
                                        </a>
                                    </div>

                                    {user.bio && (
                                        <p className="text-lg text-zinc-300 max-w-2xl leading-relaxed">
                                            {user.bio}
                                        </p>
                                    )}

                                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 text-xs md:text-sm text-muted-foreground">
                                        {user.company && (
                                            <span className="flex items-center gap-1">
                                                <Building2 className="h-3 w-3" /> {user.company}
                                            </span>
                                        )}
                                        {user.location && (
                                            <span className="flex items-center gap-1">
                                                <MapPin className="h-3 w-3" /> {user.location}
                                            </span>
                                        )}
                                        <span className="flex items-center gap-1">
                                            <Users className="h-3 w-3" /> {user.followers} followers
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <Calendar className="h-3 w-3" /> {accountAge}yr old account
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* ====== PERSONA TOGGLE ====== */}
                <div className="flex gap-2 w-full">
                    <Link
                        href={`/report/${username}?persona=recruiter`}
                        className={`flex-1 px-4 py-3 rounded-lg border text-sm font-medium text-center transition-all duration-200 ${persona === "recruiter"
                                ? "border-cyan-500 bg-cyan-500/10 text-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.15)]"
                                : "border-white/10 bg-white/[0.02] text-zinc-400 hover:border-white/20 hover:bg-white/[0.04]"
                            }`}
                    >
                        <span className="block text-base">🕵️ FAANG Recruiter</span>
                        <span className="block text-[11px] text-zinc-500 mt-0.5 font-normal">
                            Strict. Tests, types, CI/CD.
                        </span>
                    </Link>
                    <Link
                        href={`/report/${username}?persona=founder`}
                        className={`flex-1 px-4 py-3 rounded-lg border text-sm font-medium text-center transition-all duration-200 ${persona === "founder"
                                ? "border-orange-500 bg-orange-500/10 text-orange-400 shadow-[0_0_12px_rgba(249,115,22,0.15)]"
                                : "border-white/10 bg-white/[0.02] text-zinc-400 hover:border-white/20 hover:bg-white/[0.04]"
                            }`}
                    >
                        <span className="block text-base">🚀 YC Founder</span>
                        <span className="block text-[11px] text-zinc-500 mt-0.5 font-normal">
                            Pragmatic. Ships & deploys.
                        </span>
                    </Link>
                </div>

                {/* ====== SCORE CARD ====== */}
                <div className="animate-fade-in-up-delay-1">
                    <Card className="overflow-hidden">
                        <CardHeader>
                            <CardTitle className="flex items-center justify-between text-lg md:text-xl">
                                <div className="space-y-1">
                                    <span>Hiring Signal Score</span>
                                    {analysis.role_fit && (
                                        <span className="block text-sm font-normal text-zinc-400">
                                            Role Fit: <span className="text-cyan-400 font-medium">{analysis.role_fit}</span>
                                        </span>
                                    )}
                                </div>
                                <AnimatedScore score={scoreVal} />
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <AnimatedProgressBar
                                score={scoreVal}
                                indicatorClassName={scoreBarClass}
                                className="h-4 w-full"
                            />
                            <p className="text-lg md:text-xl text-zinc-300 leading-relaxed font-medium">
                                {analysis.summary}
                            </p>
                            <div className="flex gap-2 flex-wrap">
                                <Badge variant={verdictVariant} className="text-sm px-3 py-1">
                                    {analysis.recruiter_verdict}
                                </Badge>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* ====== DIMENSION SCORES ====== */}
                <div className="animate-fade-in-up-delay-2 grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                    <Card className="md:col-span-2">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-cyan-400 text-lg md:text-xl">
                                <Activity className="h-5 w-5" />
                                Dimension Scores
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-6">
                                {([
                                    { key: "documentation" as const, label: "Documentation", icon: BookOpen },
                                    { key: "code_structure" as const, label: "Code Structure", icon: FolderTree },
                                    { key: "consistency" as const, label: "Consistency", icon: Activity },
                                    { key: "impact" as const, label: "Impact", icon: Rocket },
                                    { key: "technical_depth" as const, label: "Technical Depth", icon: Cpu },
                                ]).map(({ key, label, icon: Icon }) => {
                                    const dim = analysis.dimensions[key];
                                    const pct = (dim.score / 10) * 100;
                                    const barColor = dim.score >= 7 ? "bg-emerald-400" : dim.score >= 4 ? "bg-yellow-400" : "bg-red-400";
                                    return (
                                        <div key={key} className="space-y-2">
                                            <div className="flex items-center justify-between text-sm md:text-base">
                                                <span className="flex items-center gap-2 font-medium text-foreground">
                                                    <Icon className="h-4 w-4 md:h-5 md:w-5 text-cyan-400/70" />
                                                    {label}
                                                </span>
                                                <span className="font-mono text-muted-foreground font-semibold">{dim.score}/10</span>
                                            </div>
                                            <div className="h-2.5 w-full rounded-full bg-white/10 overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full transition-all duration-700 ${barColor}`}
                                                    style={{ width: `${pct}%` }}
                                                />
                                            </div>
                                            <p className="text-sm text-muted-foreground">{dim.comment}</p>
                                        </div>
                                    );
                                })}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* ====== ACTIONABLE FEEDBACK ====== */}
                <div className="animate-fade-in-up-delay-3">
                    <Card className="border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.15)] bg-cyan-950/10">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-cyan-400 text-lg md:text-xl">
                                <Wrench className="h-5 w-5" />
                                Actionable Feedback
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ul className="space-y-4">
                                {analysis.actionable_feedback.map((item: string, i: number) => (
                                    <li key={i} className="flex items-start gap-3 text-base">
                                        <Wrench className="h-5 w-5 text-cyan-400 mt-0.5 shrink-0" />
                                        <span className="text-zinc-300 leading-relaxed">{item}</span>
                                    </li>
                                ))}
                            </ul>
                        </CardContent>
                    </Card>
                </div>

                {/* ====== REPOSITORY AUDIT ====== */}
                <div className="animate-fade-in-up-delay-3">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
                                <FileText className="h-5 w-5 text-cyan-400" />
                                Repository Audit
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {repos.map((repo) => (
                                    <a
                                        key={repo.name}
                                        href={repo.html_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="group flex items-start gap-3 p-4 rounded-lg border border-white/5 bg-white/[0.02] hover:bg-white/[0.06] hover:border-white/10 transition-all duration-200"
                                    >
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="font-semibold text-base text-foreground break-all group-hover:text-cyan-400 transition-colors">
                                                    {repo.name}
                                                </span>
                                                {repo.readme_content ? (
                                                    <Badge variant="success" className="text-[10px] px-1.5 py-0 shrink-0">
                                                        README
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="destructive" className="text-[10px] px-1.5 py-0 shrink-0">
                                                        No README
                                                    </Badge>
                                                )}
                                            </div>
                                            {repo.description && (
                                                <p className="text-sm text-muted-foreground truncate">
                                                    {repo.description}
                                                </p>
                                            )}
                                            <div className="flex items-center gap-3 mt-3 text-xs md:text-sm text-muted-foreground">
                                                {repo.language && (
                                                    <span className="flex items-center gap-1">
                                                        <span className="w-2 h-2 rounded-full bg-cyan-400" />
                                                        {repo.language}
                                                    </span>
                                                )}
                                                <span className="flex items-center gap-1">
                                                    <Star className="h-3 w-3" />
                                                    {repo.stargazers_count}
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <GitFork className="h-3 w-3" />
                                                    {repo.forks_count}
                                                </span>
                                            </div>
                                        </div>
                                        <ExternalLink className="h-4 w-4 text-muted-foreground/40 group-hover:text-cyan-400 transition-colors shrink-0 mt-1" />
                                    </a>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Footer */}
                <footer className="text-center text-xs text-muted-foreground py-4 font-mono space-y-1">
                    <div>
                        <span className="text-cyan-400/60">$</span> Viewed as{" "}
                        <span className="text-cyan-400">{persona === "recruiter" ? "🕵️ FAANG Recruiter" : "🚀 YC Founder"}</span>
                        {" · "}
                        <Link href={`/report/${username}?persona=${otherPersona}`} className="underline hover:text-cyan-400 transition-colors">
                            Switch to {otherPersona === "recruiter" ? "Recruiter" : "Founder"} view
                        </Link>
                    </div>
                    <div>
                        <span className="text-cyan-400/60">$</span> Analysis generated at{" "}
                        {new Date(profileData.fetchedAt).toLocaleString()}
                    </div>
                </footer>
            </div>
        </main>
    );
}
