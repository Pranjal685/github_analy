import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Swords, Trophy, Target, ArrowLeft, TrendingUp } from "lucide-react";

export const revalidate = 0;

export default async function DashboardPage() {
    const session = await getServerSession();

    if (!session?.user) {
        redirect("/api/auth/signin");
    }

    // Get username from session — fallback to name
    const username = (session.user as any).username || session.user.name || "";

    // Fetch all battles where user is involved
    const battles = await prisma.battle.findMany({
        where: {
            OR: [
                { user1: { equals: username, mode: "insensitive" } },
                { user2: { equals: username, mode: "insensitive" } },
            ],
        },
        orderBy: { createdAt: "desc" },
    });

    // Calculate stats
    const totalBattles = battles.length;
    const victories = battles.filter(
        (b) => b.winner.toLowerCase() === username.toLowerCase()
    ).length;
    const winRate = totalBattles > 0 ? Math.round((victories / totalBattles) * 100) : 0;

    return (
        <main className="relative min-h-screen p-4 md:p-8">
            {/* Radial glow */}
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-yellow-500/[0.05] rounded-full blur-[140px] pointer-events-none" />

            <div className="max-w-5xl mx-auto space-y-8 relative z-10">
                {/* Back */}
                <Link href="/">
                    <button className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-zinc-400 hover:text-white transition rounded-md hover:bg-white/5">
                        <ArrowLeft className="h-4 w-4" />
                        Home
                    </button>
                </Link>

                {/* Header */}
                <div className="flex items-center gap-5">
                    {session.user.image && (
                        <img
                            src={session.user.image}
                            alt="Avatar"
                            className="w-16 h-16 rounded-2xl border-2 border-yellow-500/30 shadow-[0_0_30px_rgba(234,179,8,0.1)]"
                        />
                    )}
                    <div>
                        <h1 className="text-3xl font-bold text-white">
                            Welcome back, <span className="bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent">{username}</span>
                        </h1>
                        <p className="text-zinc-400 mt-1">Your battle headquarters</p>
                    </div>
                </div>

                {/* Stat Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <StatCard
                        icon={<Swords className="h-5 w-5 text-orange-400" />}
                        label="Total Battles"
                        value={totalBattles.toString()}
                        accent="orange"
                    />
                    <StatCard
                        icon={<Trophy className="h-5 w-5 text-yellow-400" />}
                        label="Victories"
                        value={victories.toString()}
                        accent="yellow"
                    />
                    <StatCard
                        icon={<TrendingUp className="h-5 w-5 text-emerald-400" />}
                        label="Win Rate"
                        value={`${winRate}%`}
                        accent="emerald"
                    />
                </div>

                {/* Battle History */}
                <div>
                    <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                        <Target className="h-5 w-5 text-zinc-400" />
                        Battle History
                    </h2>

                    {battles.length === 0 ? (
                        <div className="text-center py-16 border border-dashed border-zinc-700 rounded-xl bg-zinc-900/30">
                            <Swords className="h-12 w-12 text-zinc-600 mx-auto mb-4" />
                            <p className="text-zinc-400 text-lg font-medium">No battles yet</p>
                            <p className="text-zinc-500 mt-1 mb-4">Time to prove yourself in the arena!</p>
                            <Link
                                href="/compare"
                                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-orange-500 to-red-600 text-white font-bold text-sm hover:from-orange-600 hover:to-red-700 transition-all"
                            >
                                <Swords className="h-4 w-4" />
                                Enter the Arena
                            </Link>
                        </div>
                    ) : (
                        <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900/50 backdrop-blur-sm">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-zinc-800 text-zinc-400 text-left">
                                        <th className="px-5 py-3 font-medium">Result</th>
                                        <th className="px-5 py-3 font-medium">Opponent</th>
                                        <th className="px-5 py-3 font-medium">Score</th>
                                        <th className="px-5 py-3 font-medium">Persona</th>
                                        <th className="px-5 py-3 font-medium">Date</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {battles.map((battle) => {
                                        const isUser1 = battle.user1.toLowerCase() === username.toLowerCase();
                                        const opponent = isUser1 ? battle.user2 : battle.user1;
                                        const userScore = isUser1 ? battle.score1 : battle.score2;
                                        const opponentScore = isUser1 ? battle.score2 : battle.score1;
                                        const won = battle.winner.toLowerCase() === username.toLowerCase();

                                        return (
                                            <tr
                                                key={battle.id}
                                                className="border-b border-zinc-800/50 hover:bg-white/[0.02] transition-colors"
                                            >
                                                <td className="px-5 py-3.5">
                                                    <span
                                                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold tracking-wide ${won
                                                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                                                : "bg-red-500/10 text-red-400 border border-red-500/20"
                                                            }`}
                                                    >
                                                        {won ? "VICTORY" : "DEFEAT"}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-3.5 text-zinc-300 font-medium font-mono">
                                                    {opponent}
                                                </td>
                                                <td className="px-5 py-3.5 font-mono">
                                                    <span className={won ? "text-emerald-400" : "text-red-400"}>{userScore}</span>
                                                    <span className="text-zinc-600 mx-1">vs</span>
                                                    <span className="text-zinc-400">{opponentScore}</span>
                                                </td>
                                                <td className="px-5 py-3.5">
                                                    <span className="inline-flex px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-400 text-xs capitalize">
                                                        {battle.persona === "recruiter" ? "🕵️" : "🚀"} {battle.persona}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-3.5 text-zinc-500 text-xs">
                                                    {new Date(battle.createdAt).toLocaleDateString("en-US", {
                                                        month: "short",
                                                        day: "numeric",
                                                        year: "numeric",
                                                    })}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <footer className="text-center text-xs text-zinc-500 py-4 font-mono">
                    <span className="text-yellow-400/60">$</span> Your Battle HQ — Powered by DevDuel
                </footer>
            </div>
        </main>
    );
}

function StatCard({
    icon,
    label,
    value,
    accent,
}: {
    icon: React.ReactNode;
    label: string;
    value: string;
    accent: "orange" | "yellow" | "emerald";
}) {
    const borderColors = {
        orange: "border-orange-500/20 hover:border-orange-500/40",
        yellow: "border-yellow-500/20 hover:border-yellow-500/40",
        emerald: "border-emerald-500/20 hover:border-emerald-500/40",
    };
    const glowColors = {
        orange: "shadow-[0_0_30px_rgba(249,115,22,0.05)]",
        yellow: "shadow-[0_0_30px_rgba(234,179,8,0.05)]",
        emerald: "shadow-[0_0_30px_rgba(16,185,129,0.05)]",
    };

    return (
        <div
            className={`p-5 rounded-xl bg-zinc-900/50 border ${borderColors[accent]} ${glowColors[accent]} backdrop-blur-sm transition-all duration-300`}
        >
            <div className="flex items-center gap-2 mb-2">
                {icon}
                <span className="text-sm text-zinc-400">{label}</span>
            </div>
            <p className="text-3xl font-bold text-white font-mono">{value}</p>
        </div>
    );
}
