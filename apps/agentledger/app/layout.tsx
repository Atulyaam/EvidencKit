import "./globals.css";
import React from "react";
import Link from "next/link";

export const metadata = {
  title: "AgentLedger — AI-Agent Workflow & Action Auditing",
  description: "Audit AI-agent tool executions, approvals, and file modifications with EvidenceKit"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-zinc-950 text-zinc-100 antialiased font-sans flex flex-col">
        <header className="border-b border-zinc-800 bg-zinc-900/70 backdrop-blur sticky top-0 z-50 px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-3 group">
              <span className="h-6 w-2 rounded-sm bg-purple-500 group-hover:bg-purple-400 transition-colors inline-block" />
              <div className="flex items-baseline gap-2">
                <span className="text-lg font-bold tracking-tight text-zinc-100 group-hover:text-purple-300 transition-colors">
                  AgentLedger
                </span>
                <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-purple-950/80 text-purple-300 border border-purple-800/60">
                  Audit Stream
                </span>
              </div>
            </Link>

            <nav className="hidden md:flex items-center gap-1 text-sm font-medium">
              <Link
                href="/"
                className="px-3 py-1.5 rounded-md text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors"
              >
                Dashboard
              </Link>
              <Link
                href="/sessions"
                className="px-3 py-1.5 rounded-md text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors"
              >
                Sessions
              </Link>
              <Link
                href="/sessions/new"
                className="px-3 py-1.5 rounded-md text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors"
              >
                New Session
              </Link>
              <Link
                href="/verify"
                className="px-3 py-1.5 rounded-md text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors"
              >
                Verify Bundle
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-zinc-800/80 border border-zinc-700/60 text-xs text-zinc-300">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="hidden sm:inline font-mono">Owner / Auditor Mode</span>
              <span className="sm:hidden font-mono">Active</span>
            </div>
            <a
              href="http://localhost:3001"
              target="_blank"
              rel="noreferrer"
              className="hidden lg:inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 px-2.5 py-1 rounded border border-zinc-800 hover:bg-zinc-800 transition-colors"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-500" />
              TraceVault App ↗
            </a>
          </div>
        </header>

        <main className="flex-1">{children}</main>

        <footer className="border-t border-zinc-800/80 bg-zinc-950/80 px-6 py-4 text-xs text-zinc-500 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>EvidenceKit Engine • Cryptographically Sealed RFC8785 SHA-256 Hash Chaining</div>
          <div className="font-mono text-[11px] text-zinc-400">
            AgentLedger • Kiroween 2026 Hackathon
          </div>
        </footer>
      </body>
    </html>
  );
}
