"use client";

import { SearchForm } from "@/components/search-form";
import { Terminal, Zap, Shield, Github, Swords, Trophy } from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";

const container = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.12, delayChildren: 0.1 },
  },
};

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" as const } },
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.8 },
  show: { opacity: 1, scale: 1, transition: { duration: 0.5, ease: "easeOut" as const } },
};

export default function HomePage() {
  return (
    <main className="relative min-h-screen flex flex-col items-center justify-center px-4 overflow-hidden">
      {/* Radial glow behind hero */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-cyan-500/[0.07] rounded-full blur-[140px] pointer-events-none" />

      {/* Hero Content */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="relative z-10 flex flex-col items-center text-center space-y-8 max-w-2xl"
      >
        {/* Logo / Icon */}
        <motion.div variants={scaleIn}>
          <motion.div
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 mb-4 shadow-[0_0_40px_rgba(0,255,255,0.1)]"
          >
            <Terminal className="h-8 w-8 text-cyan-400" />
          </motion.div>
        </motion.div>

        {/* Heading */}
        <motion.div variants={fadeUp} className="space-y-4">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight">
            <span className="text-white">GitHub Portfolio</span>
            <br />
            <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
              Auditor
            </span>
          </h1>
          <p className="text-lg sm:text-xl text-zinc-400 max-w-md mx-auto leading-relaxed">
            Will you get hired?{" "}
            <span className="text-cyan-400/80">AI-powered analysis</span> for
            developers.
          </p>
        </motion.div>

        {/* Search Form */}
        <motion.div variants={fadeUp} className="w-full flex justify-center">
          <SearchForm />
        </motion.div>

        {/* Feature Pills */}
        <motion.div variants={fadeUp} className="flex flex-wrap items-center justify-center gap-4 pt-4">
          <FeaturePill icon={<Zap className="h-3.5 w-3.5" />} text="Instant Analysis" />
          <FeaturePill icon={<Shield className="h-3.5 w-3.5" />} text="Recruiter Perspective" />
          <FeaturePill icon={<Github className="h-3.5 w-3.5" />} text="Public Profiles Only" />
        </motion.div>

        {/* DevDuel Link */}
        <motion.div variants={fadeUp} className="flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/compare"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-orange-500/20 bg-orange-500/[0.06] text-sm text-orange-400 hover:border-orange-500/40 hover:bg-orange-500/10 hover:text-orange-300 transition-all duration-300 font-medium"
          >
            <Swords className="h-4 w-4" />
            ⚔️ DevDuel — Compare two profiles
          </Link>
          <Link
            href="/leaderboard"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-yellow-500/20 bg-yellow-500/[0.06] text-sm text-yellow-400 hover:border-yellow-500/40 hover:bg-yellow-500/10 hover:text-yellow-300 transition-all duration-300 font-medium"
          >
            <Trophy className="h-4 w-4" />
            🏆 Leaderboard
          </Link>
        </motion.div>
      </motion.div>

      {/* Footer */}
      <motion.footer
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8, duration: 0.6 }}
        className="absolute bottom-6 text-sm text-zinc-500 font-mono"
      >
        <span className="text-cyan-400/60">$</span> Built for the GitHub Portfolio Hackathon
      </motion.footer>
    </main>
  );
}

function FeaturePill({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] text-sm text-zinc-400 hover:border-cyan-500/30 hover:text-zinc-300 transition-all duration-300">
      <span className="text-cyan-400">{icon}</span>
      {text}
    </div>
  );
}
