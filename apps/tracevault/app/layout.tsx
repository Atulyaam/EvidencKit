import "./globals.css";
import React from "react";
import { TraceVaultNavbar } from "../components/navbar";

export const metadata = {
  title: "TraceVault — Software Incident Evidence Reconstruction",
  description: "Reconstruct software incidents with evidence-backed hash-chain timelines"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-zinc-950 text-zinc-100 antialiased flex flex-col font-sans selection:bg-blue-600/30 selection:text-blue-200">
        <TraceVaultNavbar />
        <main className="flex-1 w-full max-w-full overflow-x-hidden">{children}</main>
        <footer className="border-t border-zinc-900 bg-zinc-950/80 px-4 sm:px-6 py-4 text-center text-xs text-zinc-500">
          <p>
            TraceVault • Powered by EvidenceKit (RFC 8785 Canonical JCS + SHA-256 Hash Chaining) •
            Kiroween 2026
          </p>
        </footer>
      </body>
    </html>
  );
}
