"use client";

import { useEffect } from "react";
import type { CompareResult } from "@/lib/types";
import { Trophy, Zap, Shield, Rocket, Star, ScanSearch } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface BattleResultProps {
    result: CompareResult;
}

function HeadToHeadBar({
    label,
    icon: Icon,
    winner,
    user1,
    user2,
}: {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    winner: string;
    user1: string;
    user2: string;
}) {
    const isUser1 = winner === "user1";
    const isUser2 = winner === "user2";

    return (
        <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-sm text-zinc-400">
                <Icon className="h-4 w-4" />
                <span className="font-medium">{label}</span>
            </div>
            <div className="flex gap-1.5 h-7 items-center">
                {/* User 1 bar */}
                <div className="flex-1 flex items-center justify-end">
                    <span className="text-xs text-zinc-400 mr-2 font-mono">{user1}</span>
                    <div
                        className={`h-full rounded-l-md transition-all duration-500 ${isUser1
                            ? "bg-gradient-to-r from-cyan-500 to-blue-500 w-3/4 shadow-[0_0_15px_rgba(6,182,212,0.2)]"
                            : "bg-zinc-700/50 w-1/4"
                            }`}
                    />
                </div>
                {/* User 2 bar */}
                <div className="flex-1 flex items-center">
                    <div
                        className={`h-full rounded-r-md transition-all duration-500 ${isUser2
                            ? "bg-gradient-to-r from-orange-500 to-red-500 w-3/4 shadow-[0_0_15px_rgba(249,115,22,0.2)]"
                            : "bg-zinc-700/50 w-1/4"
                            }`}
                    />
                    <span className="text-xs text-zinc-400 ml-2 font-mono">{user2}</span>
                </div>
            </div>
        </div>
    );
}

function DeepScanCard({ username, insight, gradient }: { username: string; insight: string; gradient: string }) {
    return (
        <div className="mt-3 rounded-lg bg-[#0a0f1a] border border-zinc-800/60 overflow-hidden">
            <div className={`px-4 py-2 flex items-center gap-2 border-b border-zinc-800/60 bg-gradient-to-r ${gradient}`}>
                <ScanSearch className="h-3.5 w-3.5 text-zinc-300" />
                <span className="text-xs font-bold text-zinc-300 font-mono tracking-wider uppercase">
                    Deep Scan — {username}
                </span>
            </div>
            <div className="px-4 py-3">
                <p className="text-xs text-emerald-400/90 font-mono leading-relaxed">
                    <span className="text-zinc-500 select-none">&gt; </span>
                    {insight}
                </p>
            </div>
        </div>
    );
}

export function BattleResult({ result }: BattleResultProps) {
    const { winner, winner_reason, head_to_head, user1_stats, user2_stats, user1_username, user2_username, deep_scan_insights } = result;

    // Step 3: Update URL with scores so shared links trigger OG image
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        params.set("user1", user1_username);
        params.set("user2", user2_username);
        params.set("score1", user1_stats.score.toString());
        params.set("score2", user2_stats.score.toString());
        params.set("winner", winner);
        window.history.replaceState(null, "", `?${params.toString()}`);
    }, [result, user1_username, user2_username, user1_stats.score, user2_stats.score, winner]);

    const isUser1Winner = winner === "user1";
    const isUser2Winner = winner === "user2";
    const isTie = winner === "tie";

    const winnerName = isUser1Winner ? user1_username : isUser2Winner ? user2_username : null;

    return (
        <div className="space-y-6 animate-fade-in-up">
            {/* Winner Banner */}
            <Card className={`overflow-hidden ${isTie
                ? "border-yellow-500/30 shadow-[0_0_30px_rgba(234,179,8,0.1)]"
                : "border-yellow-500/50 shadow-[0_0_40px_rgba(234,179,8,0.15)]"
                }`}>
                <CardContent className="pt-6 text-center space-y-3">
                    <Trophy className={`h-12 w-12 mx-auto ${isTie ? "text-yellow-500/60" : "text-yellow-400"}`} />
                    <h2 className="text-3xl font-bold text-white">
                        {isTie ? "It's a Tie!" : `${winnerName} Wins!`}
                    </h2>
                    <p className="text-lg text-zinc-300 max-w-xl mx-auto leading-relaxed">
                        {winner_reason}
                    </p>
                </CardContent>
            </Card>

            {/* Score Cards Side-by-Side */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* User 1 Card */}
                <Card className={`transition-all ${isUser1Winner
                    ? "ring-2 ring-yellow-500/60 shadow-[0_0_25px_rgba(234,179,8,0.12)]"
                    : "border-white/5"
                    }`}>
                    <CardHeader className="pb-2">
                        <CardTitle className="flex items-center justify-between">
                            <span className="text-lg text-white">{user1_username}</span>
                            {isUser1Winner && (
                                <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded-full font-mono">
                                    👑 WINNER
                                </span>
                            )}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="text-5xl font-bold text-center py-3 bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
                            {user1_stats.score}
                        </div>
                        <div className="flex items-center justify-between text-sm text-zinc-400">
                            <span className="flex items-center gap-1.5">
                                <Star className="h-3.5 w-3.5 text-yellow-400/70" />
                                {user1_stats.top_repo}
                            </span>
                        </div>
                        {/* Deep Scan Insight — User 1 */}
                        {deep_scan_insights?.user1_insight && (
                            <DeepScanCard
                                username={user1_username}
                                insight={deep_scan_insights.user1_insight}
                                gradient="from-cyan-900/20 to-blue-900/20"
                            />
                        )}
                    </CardContent>
                </Card>

                {/* User 2 Card */}
                <Card className={`transition-all ${isUser2Winner
                    ? "ring-2 ring-yellow-500/60 shadow-[0_0_25px_rgba(234,179,8,0.12)]"
                    : "border-white/5"
                    }`}>
                    <CardHeader className="pb-2">
                        <CardTitle className="flex items-center justify-between">
                            <span className="text-lg text-white">{user2_username}</span>
                            {isUser2Winner && (
                                <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded-full font-mono">
                                    👑 WINNER
                                </span>
                            )}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="text-5xl font-bold text-center py-3 bg-gradient-to-r from-orange-400 to-red-500 bg-clip-text text-transparent">
                            {user2_stats.score}
                        </div>
                        <div className="flex items-center justify-between text-sm text-zinc-400">
                            <span className="flex items-center gap-1.5">
                                <Star className="h-3.5 w-3.5 text-yellow-400/70" />
                                {user2_stats.top_repo}
                            </span>
                        </div>
                        {/* Deep Scan Insight — User 2 */}
                        {deep_scan_insights?.user2_insight && (
                            <DeepScanCard
                                username={user2_username}
                                insight={deep_scan_insights.user2_insight}
                                gradient="from-orange-900/20 to-red-900/20"
                            />
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Head-to-Head Comparison Bars */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-cyan-400 text-lg">
                        ⚔️ Head-to-Head
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                    <HeadToHeadBar
                        label="Velocity"
                        icon={Zap}
                        winner={head_to_head.velocity}
                        user1={user1_username}
                        user2={user2_username}
                    />
                    <HeadToHeadBar
                        label="Quality"
                        icon={Shield}
                        winner={head_to_head.quality}
                        user1={user1_username}
                        user2={user2_username}
                    />
                    <HeadToHeadBar
                        label="Impact"
                        icon={Rocket}
                        winner={head_to_head.impact}
                        user1={user1_username}
                        user2={user2_username}
                    />
                </CardContent>
            </Card>
        </div>
    );
}
