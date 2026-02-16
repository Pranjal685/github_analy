"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Loader2, ChevronDown } from "lucide-react";
import { extractUsername } from "@/lib/utils";

const PERSONAS = [
    { value: "recruiter" as const, label: "🕵️ Recruiter Mode", desc: "Strict · Tests, types, CI/CD" },
    { value: "founder" as const, label: "🚀 Founder Mode", desc: "Pragmatic · Ships & deploys" },
];

export function SearchForm() {
    const [inputValue, setInputValue] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [persona, setPersona] = useState<"recruiter" | "founder">("recruiter");
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const router = useRouter();

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

    const selected = PERSONAS.find((p) => p.value === persona)!;

    return (
        <form onSubmit={handleSubmit} className="flex flex-col w-full max-w-lg gap-3">
            {/* Search Input + Persona Dropdown */}
            <div className="flex gap-3 w-full">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-500" />
                    <Input
                        type="text"
                        placeholder="Enter GitHub URL or username..."
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

                {/* Custom Themed Dropdown */}
                <div className="relative" ref={dropdownRef}>
                    <button
                        type="button"
                        onClick={() => setDropdownOpen((prev) => !prev)}
                        disabled={isLoading}
                        className="flex items-center gap-2 bg-zinc-900/80 border border-zinc-700 text-zinc-100 text-sm rounded-lg px-3 py-2 outline-none hover:border-zinc-500 focus:ring-2 focus:ring-cyan-500/50 transition-all cursor-pointer whitespace-nowrap backdrop-blur-sm h-full"
                    >
                        <span>{selected.label}</span>
                        <ChevronDown className={`h-3.5 w-3.5 text-zinc-400 transition-transform duration-200 ${dropdownOpen ? "rotate-180" : ""}`} />
                    </button>

                    {dropdownOpen && (
                        <div className="absolute top-full mt-1 right-0 z-50 min-w-[200px] rounded-lg border border-zinc-700 bg-zinc-900/95 backdrop-blur-md shadow-[0_8px_30px_rgba(0,0,0,0.5)] overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
                            {PERSONAS.map((p) => (
                                <button
                                    key={p.value}
                                    type="button"
                                    onClick={() => {
                                        setPersona(p.value);
                                        setDropdownOpen(false);
                                    }}
                                    className={`w-full text-left px-4 py-2.5 text-sm transition-colors cursor-pointer ${persona === p.value
                                            ? "bg-cyan-500/10 text-cyan-400"
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
                    Pick a perspective, then paste a GitHub URL or username.
                </p>
            )}
        </form>
    );
}
