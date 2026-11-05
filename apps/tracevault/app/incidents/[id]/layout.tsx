"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import { Badge, IntegrityStatus } from "@evidencekit/ui";

interface IncidentLayoutProps {
  children: React.ReactNode;
  params?: { id: string };
}

interface IncidentData {
  id: string;
  streamId: string;
  title: string;
  description?: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  status: "open" | "investigating" | "mitigated" | "resolved" | "closed";
  environment: string;
  createdAt: string;
  updatedAt: string;
}

export default function IncidentLayout({ children, params }: IncidentLayoutProps) {
  const routeParams = useParams();
  const incidentId = (routeParams?.id as string) || params?.id || "";
  const pathname = usePathname();

  const [incident, setIncident] = useState<IncidentData | null>(null);
  const [integrity, setIntegrity] = useState<{
    status: "verified" | "failed" | "unanchored" | "incomplete";
    totalEvents: number;
    headHash?: string;
  }>({
    status: "verified",
    totalEvents: 0
  });

  const loadData = async () => {
    try {
      const res = await fetch(`/api/incidents/${incidentId}`);
      if (res.ok) {
        const data = await res.json();
        setIncident(data);
      }

      const timelineRes = await fetch(`/api/incidents/${incidentId}/timeline?limit=1`);
      if (timelineRes.ok) {
        const tData = await timelineRes.json();
        setIntegrity({
          status: tData.verification?.status || "verified",
          totalEvents: tData.total || 0,
          headHash: tData.verification?.head_hash
        });
      }
    } catch {
      // Ignore network errors on background poll
    }
  };

  useEffect(() => {
    loadData();
  }, [incidentId, pathname]);

  const navTabs = [
    { label: "Overview", href: `/incidents/${incidentId}` },
    { label: "Evidence & Sources", href: `/incidents/${incidentId}/evidence` },
    { label: "Forensic Timeline", href: `/incidents/${incidentId}/timeline` },
    { label: "Investigation Report", href: `/incidents/${incidentId}/report` },
    { label: "Settings & Export", href: `/incidents/${incidentId}/settings` }
  ];

  const getSeverityBadge = (sev: string) => {
    switch (sev) {
      case "critical":
        return <Badge variant="danger">Critical</Badge>;
      case "high":
        return <Badge variant="warning">High</Badge>;
      case "medium":
        return <Badge variant="default">Medium</Badge>;
      default:
        return <Badge variant="outline">{sev}</Badge>;
    }
  };

  const getStatusBadge = (st: string) => {
    switch (st) {
      case "open":
        return <Badge variant="danger">Open</Badge>;
      case "investigating":
        return <Badge variant="warning">Investigating</Badge>;
      case "mitigated":
        return <Badge variant="default">Mitigated</Badge>;
      case "resolved":
      case "closed":
        return <Badge variant="success">{st}</Badge>;
      default:
        return <Badge variant="outline">{st}</Badge>;
    }
  };

  return (
    <div className="min-h-full flex flex-col">
      {/* Incident Subheader */}
      <div className="border-b border-zinc-800 bg-zinc-900/60 backdrop-blur px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <Link
                href="/incidents"
                className="text-xs text-zinc-400 hover:text-zinc-200 font-medium"
              >
                Incidents /
              </Link>
              <h2 className="text-lg font-bold tracking-tight text-white">
                {incident?.title || `Incident #${incidentId}`}
              </h2>
              {incident && getSeverityBadge(incident.severity)}
              {incident && getStatusBadge(incident.status)}
              {incident && (
                <span className="font-mono text-xs text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded">
                  {incident.environment}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs text-zinc-400 font-mono">
              <span>Stream: {incident?.streamId || incidentId}</span>
              <span>•</span>
              <span>
                Updated:{" "}
                {incident?.updatedAt
                  ? new Date(incident.updatedAt).toLocaleTimeString()
                  : "recently"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <IntegrityStatus
              status={integrity.status}
              totalEvents={integrity.totalEvents}
              headHash={integrity.headHash}
            />
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="max-w-7xl mx-auto flex items-center gap-1 mt-4 pt-2 border-t border-zinc-800/60 overflow-x-auto text-xs">
          {navTabs.map((tab) => {
            const isActive =
              tab.href === `/incidents/${incidentId}`
                ? pathname === tab.href
                : pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`px-3 py-1.5 rounded-md font-medium transition-colors whitespace-nowrap ${
                  isActive
                    ? "bg-zinc-800 text-white border border-zinc-700/80"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
      </div>

      <div className="flex-1 max-w-7xl w-full mx-auto p-6">{children}</div>
    </div>
  );
}
