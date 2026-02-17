"use client";

import { useState, useRef, useEffect } from "react";
import { performComparison } from "@/app/actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { BattleResult } from "@/components/battle-result";
import { Swords, Loader2, ArrowLeft, ChevronDown } from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";
import type { CompareResult } from "@/lib/types";

const PERSONAS = [
    { value: "recruiter" as const, label: "🕵️ Recruiter Mode", desc: "Strict · Tests, types, CI/CD" },
    { value: "founder" as const, label: "🚀 Founder Mode", desc: "Pragmatic · Ships & deploys" },
];

const fadeUp = {
    hidden: { opacity: 0, y: 24 },
    show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" as const } },
};

const container = {
    hidden: {},
    show: {
        transition: { staggerChildren: 0.1, delayChildren: 0.05 },
    },
};

export default function CompareClient() {
    const [user1, setUser1] = useState("");
    const [user2, setUser2] = useState("");
    const [persona, setPersona] = useState<"recruiter" | "founder">("recruiter");
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<CompareResult | null>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown on outside click
    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setDropdownOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleFight = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!user1.trim() || !user2.trim()) {
            setError("Both challenger fields are required.");
            return;
        }

        setIsLoading(true);
        setResult(null);

        try {
            const res = await performComparison(user1.trim(), user2.trim(), persona);
            if (res.success && res.data) {
                setResult(res.data);
            } else {
                setError(res.error || "Comparison failed.");
            }
        } catch {
            setError("An unexpected error occurred.");
        } finally {
            setIsLoading(false);
        }
    };

    const selected = PERSONAS.find((p) => p.value === persona)!;

    return (
        <main className="relative min-h-screen p-4 md:p-8">
            {/* Radial glow */}
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-orange-500/[0.05] rounded-full blur-[140px] pointer-events-none" />

            <div className="max-w-4xl mx-auto space-y-8 relative z-10">
                {/* Back */}
                <Link href="/">
                    <Button variant="ghost" size="sm" className="mb-2">
                        <ArrowLeft className="h-4 w-4 mr-1" />
                        Home
                    </Button>
                </Link>

                {/* Header */}
                <motion.div
                    variants={container}
                    initial="hidden"
                    animate="show"
                    className="text-center space-y-4"
                >
                    <motion.div variants={fadeUp}>
                        <motion.div
                            animate={{ rotate: [0, 5, -5, 0] }}
                            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-orange-500/10 border border-orange-500/20 mb-2 shadow-[0_0_40px_rgba(249,115,22,0.1)]"
                        >
                            <Swords className="h-8 w-8 text-orange-400" />
                        </motion.div>
                    </motion.div>

                    <motion.div variants={fadeUp}>
                        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
                            <span className="text-white">Dev</span>
                            <span className="bg-gradient-to-r from-orange-400 to-red-500 bg-clip-text text-transparent">
                                Duel
                            </span>
                        </h1>
                        <p className="text-lg text-zinc-400 mt-2">
                            Two devs enter. One <span className="text-orange-400/80">wins</span>.
                        </p>
                    </motion.div>
                </motion.div>

                {/* Battle Form */}
                <motion.form
                    onSubmit={handleFight}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3, duration: 0.5 }}
                    className="space-y-4"
                >
                    <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-3 items-end">
                        {/* User 1 */}
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-zinc-400 font-mono">
                                Challenger 1
                            </label>
                            <Input
                                type="text"
                                placeholder="e.g. Pranjal685"
                                value={user1}
                                onChange={(e) => { setUser1(e.target.value); setError(null); }}
                                disabled={isLoading}
                                autoComplete="off"
                                spellCheck={false}
                            />
                        </div>

                        {/* VS */}
                        <div className="hidden md:flex items-center justify-center px-2 pb-1">
                            <span className="text-2xl font-black text-zinc-600 font-mono">VS</span>
                        </div>
                        <div className="flex md:hidden items-center justify-center py-1">
                            <span className="text-lg font-black text-zinc-600 font-mono">VS</span>
                        </div>

                        {/* User 2 */}
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-zinc-400 font-mono">
                                Challenger 2
                            </label>
                            <Input
                                type="text"
                                placeholder="e.g. shadcn"
                                value={user2}
                                onChange={(e) => { setUser2(e.target.value); setError(null); }}
                                disabled={isLoading}
                                autoComplete="off"
                                spellCheck={false}
                            />
                        </div>
                    </div>

                    {/* Persona + Fight Button */}
                    <div className="flex gap-3 items-stretch">
                        {/* Custom Themed Dropdown */}
                        <div className="relative" ref={dropdownRef}>
                            <button
                                type="button"
                                onClick={() => setDropdownOpen((p) => !p)}
                                disabled={isLoading}
                                className="flex items-center gap-2 bg-zinc-900/80 border border-zinc-700 text-zinc-100 text-sm rounded-lg px-3 py-2 outline-none hover:border-zinc-500 focus:ring-2 focus:ring-orange-500/50 transition-all cursor-pointer whitespace-nowrap backdrop-blur-sm h-full"
                            >
                                <span>{selected.label}</span>
                                <ChevronDown className={`h-3.5 w-3.5 text-zinc-400 transition-transform duration-200 ${dropdownOpen ? "rotate-180" : ""}`} />
                            </button>

                            {dropdownOpen && (
                                <div className="absolute top-full mt-1 left-0 z-50 min-w-[200px] rounded-lg border border-zinc-700 bg-zinc-900/95 backdrop-blur-md shadow-[0_8px_30px_rgba(0,0,0,0.5)] overflow-hidden">
                                    {PERSONAS.map((p) => (
                                        <button
                                            key={p.value}
                                            type="button"
                                            onClick={() => { setPersona(p.value); setDropdownOpen(false); }}
                                            className={`w-full text-left px-4 py-2.5 text-sm transition-colors cursor-pointer ${persona === p.value
                                                ? "bg-orange-500/10 text-orange-400"
                                                : "text-zinc-300 hover:bg-white/5 hover:text-zinc-100"
                                                }`}
                                        >
                                            <span className="block font-medium">{p.label}</span>
                                            <span className="block text-[11px] text-zinc-500 mt-0.5">{p.desc}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* FIGHT Button */}
                        <Button
                            type="submit"
                            size="lg"
                            disabled={isLoading || !user1.trim() || !user2.trim()}
                            className="flex-1 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-bold text-lg shadow-[0_0_20px_rgba(249,115,22,0.2)] hover:shadow-[0_0_30px_rgba(249,115,22,0.3)] transition-all"
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                                    Analyzing fighters...
                                </>
                            ) : (
                                <>
                                    <Swords className="h-5 w-5 mr-2" />
                                    ⚔️ FIGHT
                                </>
                            )}
                        </Button>
                    </div>

                </motion.form>

                {/* Error State */}
                {error && (
                    <div className="p-6 bg-red-950 border border-red-500 rounded-xl text-center text-red-200">
                        <h2 className="text-xl font-bold">Battle Failed ⚠️</h2>
                        <p className="mt-2">{error}</p>
                    </div>
                )}

                {/* Result */}
                {result && <BattleResult result={result} />}

                {/* Footer */}
                <footer className="text-center text-xs text-muted-foreground py-4 font-mono">
                    <span className="text-orange-400/60">$</span> DevDuel — Powered by AI Referee
                </footer>
            </div>
        </main>
    );
}
