import "./globals.css";
import React from "react";

export const metadata = {
  title: "TraceVault — Software Incident Evidence Reconstruction",
  description: "Reconstruct software incidents with evidence-backed hash-chain timelines"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-zinc-950 text-zinc-100 antialiased">
        <header className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="h-6 w-2 rounded-sm bg-blue-600 inline-block" />
            <h1 className="text-lg font-bold tracking-tight">TraceVault</h1>
            <span className="text-xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 font-mono">
              Incident Evidence
            </span>
          </div>
          <div className="flex items-center gap-4 text-xs text-zinc-400">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Public Judge Mode (Read-Only)
            </span>
          </div>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
