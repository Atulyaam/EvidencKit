"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, Shield, PlusCircle, Share2, CheckCircle2, ExternalLink } from "lucide-react";
import { StatusDot } from "@evidencekit/ui";

export function TraceVaultNavbar() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { href: "/incidents", label: "Incidents", icon: <Shield className="w-4 h-4" /> },
    { href: "/incidents/new", label: "+ New Incident", icon: <PlusCircle className="w-4 h-4" /> },
    { href: "/graph", label: "Evidence Graph", icon: <Share2 className="w-4 h-4" /> },
    { href: "/verify", label: "Verify Bundle", icon: <CheckCircle2 className="w-4 h-4" /> }
  ];

  const isActive = (href: string) => {
    if (href === "/incidents") {
      return (
        pathname === "/incidents" ||
        (pathname.startsWith("/incidents/") && pathname !== "/incidents/new")
      );
    }
    return pathname === href;
  };

  return (
    <header className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14">
        {/* Brand & Desktop Navigation */}
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2.5 group select-none">
            <span className="h-6 w-2 rounded-sm bg-blue-600 group-hover:bg-blue-500 transition-colors" />
            <span className="text-lg font-bold tracking-tight text-zinc-100">TraceVault</span>
            <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 font-mono">
              EvidenceKit
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-1 text-xs font-medium">
            {navLinks.map((link) => {
              const active = isActive(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 ${
                    active
                      ? "bg-blue-600/15 text-blue-400 font-semibold"
                      : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right Action Metadata & Status Badges */}
        <div className="flex items-center gap-2.5">
          <a
            href="http://localhost:3002"
            target="_blank"
            rel="noreferrer"
            className="hidden lg:inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 px-2.5 py-1 rounded-md border border-zinc-800 hover:bg-zinc-900 transition-colors"
          >
            <StatusDot status="warning" />
            <span>AgentLedger App ↗</span>
          </a>

          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-900 border border-zinc-800 font-mono text-[11px] text-zinc-300">
            <span className="text-zinc-500">Workspace:</span>
            <span className="text-blue-400 font-semibold">default</span>
          </div>

          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950/60 border border-emerald-800/50 text-emerald-400 text-xs font-medium select-none">
            <StatusDot status="success" pulse />
            Public Judge Mode
          </span>

          {/* Mobile menu hamburger button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-1.5 rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
            aria-label="Toggle Navigation Menu"
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-zinc-800 bg-zinc-950 px-4 py-3 space-y-2 animate-in fade-in duration-150">
          <nav className="flex flex-col space-y-1">
            {navLinks.map((link) => {
              const active = isActive(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
                    active
                      ? "bg-blue-600/15 text-blue-400 font-semibold"
                      : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
                  }`}
                >
                  {link.icon}
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="pt-2 border-t border-zinc-800 flex items-center justify-between text-xs text-zinc-400">
            <div className="flex items-center gap-1.5 font-mono">
              <span className="text-zinc-500">Workspace:</span>
              <span className="text-blue-400">default</span>
            </div>
            <a
              href="http://localhost:3002"
              target="_blank"
              rel="noreferrer"
              className="text-purple-400 hover:underline inline-flex items-center gap-1"
            >
              <span>AgentLedger</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
