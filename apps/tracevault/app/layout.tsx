import "./globals.css";
import React from "react";
import Link from "next/link";

export const metadata = {
  title: "TraceVault — Software Incident Evidence Reconstruction",
  description: "Reconstruct software incidents with evidence-backed hash-chain timelines"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-zinc-950 text-zinc-100 antialiased flex flex-col font-sans">
        <header className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-900/80 backdrop-blur px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2.5 group">
              <span className="h-6 w-2 rounded-sm bg-blue-600 group-hover:bg-blue-500 transition-colors" />
              <span className="text-lg font-bold tracking-tight text-zinc-100">TraceVault</span>
              <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 font-mono">
                EvidenceKit
              </span>
            </Link>

            <nav className="hidden md:flex items-center gap-4 text-sm font-medium">
              <Link href="/incidents" className="text-zinc-300 hover:text-white transition-colors">
                Incidents
              </Link>
              <Link
                href="/incidents/new"
                className="text-zinc-400 hover:text-white transition-colors"
              >
                + New Incident
              </Link>
              <Link href="/graph" className="text-zinc-400 hover:text-white transition-colors">
                Evidence Graph
              </Link>
              <Link href="/verify" className="text-zinc-400 hover:text-white transition-colors">
                Verify Bundle
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <a
              href="http://localhost:3002"
              target="_blank"
              rel="noreferrer"
              className="hidden lg:inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 px-2.5 py-1 rounded border border-zinc-800 hover:bg-zinc-800 transition-colors"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-purple-500" />
              AgentLedger App ↗
            </a>
            <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-md bg-zinc-800/80 border border-zinc-700/60 font-mono text-[11px] text-zinc-300">
              <span className="text-zinc-500">Workspace:</span>
              <span className="text-blue-400 font-semibold">default</span>
            </div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950/60 border border-emerald-800/50 text-emerald-400 font-medium">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Public Judge Mode
            </span>
          </div>
        </header>

        <main className="flex-1">{children}</main>

        <footer className="border-t border-zinc-900 bg-zinc-950/80 px-6 py-4 text-center text-xs text-zinc-500">
          <p>
            TraceVault • Powered by EvidenceKit (RFC 8785 Canonical JCS + SHA-256 Hash Chaining) •
            Kiroween 2026
          </p>
        </footer>
      </body>
    </html>
  );
}
