"use client";

import { useState } from "react";
import type { AnalysisResult, DualAnalysisResult } from "@/lib/types";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AnimatedScore, AnimatedProgressBar } from "@/components/animated-score";
import {
    Wrench,
    BookOpen,
    FolderTree,
    Activity,
    Rocket,
    Cpu,
} from "lucide-react";

interface PersonaToggleProps {
    dualAnalysis: DualAnalysisResult;
}

type ActivePersona = "recruiter" | "founder";

export function PersonaToggle({ dualAnalysis }: PersonaToggleProps) {
    const [active, setActive] = useState<ActivePersona>("recruiter");
    const analysis: AnalysisResult = dualAnalysis[active];

    const scoreVal = analysis.total_score || 0;
    const scoreBarClass =
        scoreVal < 50
            ? "score-bar-red"
            : scoreVal < 80
                ? "score-bar-yellow"
                : "score-bar-green";

    const verdictVariant =
        analysis.recruiter_verdict === "Strong Hire"
            ? ("success" as const)
            : analysis.recruiter_verdict === "Interview"
                ? ("warning" as const)
                : ("destructive" as const);

    return (
        <>
            {/* ====== PERSONA TOGGLE ====== */}
            <div className="flex gap-2 w-full">
                <button
                    onClick={() => setActive("recruiter")}
                    className={`flex-1 px-4 py-3 rounded-lg border text-sm font-medium transition-all duration-200 cursor-pointer ${active === "recruiter"
                            ? "border-cyan-500 bg-cyan-500/10 text-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.15)]"
                            : "border-white/10 bg-white/[0.02] text-zinc-400 hover:border-white/20 hover:bg-white/[0.04]"
                        }`}
                >
                    <span className="block text-base">🕵️ FAANG Recruiter</span>
                    <span className="block text-[11px] text-zinc-500 mt-0.5 font-normal">
                        Strict. Tests, types, CI/CD.
                    </span>
                </button>
                <button
                    onClick={() => setActive("founder")}
                    className={`flex-1 px-4 py-3 rounded-lg border text-sm font-medium transition-all duration-200 cursor-pointer ${active === "founder"
                            ? "border-orange-500 bg-orange-500/10 text-orange-400 shadow-[0_0_12px_rgba(249,115,22,0.15)]"
                            : "border-white/10 bg-white/[0.02] text-zinc-400 hover:border-white/20 hover:bg-white/[0.04]"
                        }`}
                >
                    <span className="block text-base">🚀 YC Founder</span>
                    <span className="block text-[11px] text-zinc-500 mt-0.5 font-normal">
                        Pragmatic. Ships & deploys.
                    </span>
                </button>
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
        </>
    );
}
