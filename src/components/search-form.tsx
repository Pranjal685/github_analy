"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Loader2 } from "lucide-react";
import { extractUsername } from "@/lib/utils";
import { PERSONAS, type PersonaType } from "@/lib/personas";

export function SearchForm() {
    const [inputValue, setInputValue] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [persona, setPersona] = useState<PersonaType>("recruiter");
    const router = useRouter();

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        const username = extractUsername(inputValue);
        if (!username) {
            setError("Please enter a valid GitHub username or profile URL.");
            return;
        }

        setIsLoading(true);
        router.push(`/report/${encodeURIComponent(username)}?persona=${persona}`);
    };

    return (
        <form onSubmit={handleSubmit} className="flex flex-col w-full max-w-lg gap-3">
            {/* Persona Toggle */}
            <div className="flex gap-2 w-full">
                {(Object.values(PERSONAS) as typeof PERSONAS[PersonaType][]).map((p) => (
                    <button
                        key={p.id}
                        type="button"
                        onClick={() => setPersona(p.id)}
                        className={`flex-1 px-3 py-2.5 rounded-lg border text-sm font-medium transition-all duration-200 cursor-pointer ${persona === p.id
                                ? "border-cyan-500 bg-cyan-500/10 text-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.15)]"
                                : "border-white/10 bg-white/[0.02] text-zinc-400 hover:border-white/20 hover:bg-white/[0.04]"
                            }`}
                    >
                        <span className="block text-base">{p.label}</span>
                        <span className="block text-[11px] text-zinc-500 mt-0.5 font-normal">{p.description}</span>
                    </button>
                ))}
            </div>

            {/* Search Input + Button */}
            <div className="flex gap-3 w-full">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-500" />
                    <Input
                        type="text"
                        placeholder="Enter GitHub URL (e.g., https://github.com/username)..."
                        value={inputValue}
                        onChange={(e) => {
                            setInputValue(e.target.value);
                            if (error) setError(null);
                        }}
                        className={`pl-10 ${error ? "border-red-500/50 focus:border-red-500" : ""}`}
                        disabled={isLoading}
                        autoComplete="off"
                        spellCheck={false}
                    />
                </div>
                <Button type="submit" size="lg" disabled={isLoading || !inputValue.trim()}>
                    {isLoading ? (
                        <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Scanning...
                        </>
                    ) : (
                        "Analyze"
                    )}
                </Button>
            </div>

            {error ? (
                <p className="text-sm text-red-400 px-1">{error}</p>
            ) : (
                <p className="text-xs text-zinc-500 px-1">
                    Accepts profile URLs or usernames. Choose your auditor above.
                </p>
            )}
        </form>
    );
}
