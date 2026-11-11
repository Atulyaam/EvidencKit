"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import { Badge, IntegrityStatus, Breadcrumbs, BreadcrumbItem } from "@evidencekit/ui";
import { FileText, UploadCloud, Clock, ShieldCheck, FileSpreadsheet, Settings } from "lucide-react";

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
    {
      label: "Overview",
      href: `/incidents/${incidentId}`,
      icon: <FileText className="w-3.5 h-3.5" />
    },
    {
      label: "Evidence & Sources",
      href: `/incidents/${incidentId}/evidence`,
      icon: <UploadCloud className="w-3.5 h-3.5" />
    },
    {
      label: "Forensic Timeline",
      href: `/incidents/${incidentId}/timeline`,
      icon: <Clock className="w-3.5 h-3.5" />
    },
    {
      label: "Quality Audit",
      href: `/incidents/${incidentId}/quality`,
      icon: <ShieldCheck className="w-3.5 h-3.5" />
    },
    {
      label: "Investigation Report",
      href: `/incidents/${incidentId}/report`,
      icon: <FileSpreadsheet className="w-3.5 h-3.5" />
    },
    {
      label: "Settings & Export",
      href: `/incidents/${incidentId}/settings`,
      icon: <Settings className="w-3.5 h-3.5" />
    }
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
      {/* Incident Header */}
      <div className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md px-4 sm:px-6 py-4">
        <div className="max-w-7xl mx-auto space-y-4">
          <Breadcrumbs>
            <BreadcrumbItem href="/">Home</BreadcrumbItem>
            <BreadcrumbItem href="/incidents">Incidents</BreadcrumbItem>
            <BreadcrumbItem isCurrentPage>{incidentId}</BreadcrumbItem>
          </Breadcrumbs>

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                  {incident?.title || `Incident #${incidentId}`}
                </h1>
                {incident && getSeverityBadge(incident.severity)}
                {incident && getStatusBadge(incident.status)}
                {incident && (
                  <span className="font-mono text-xs text-zinc-400 bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded">
                    {incident.environment}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-400 font-mono">
                <span className="text-zinc-300 font-medium">
                  Stream: {incident?.streamId || incidentId}
                </span>
                <span className="text-zinc-600">•</span>
                <span>
                  Updated:{" "}
                  {incident?.updatedAt
                    ? new Date(incident.updatedAt).toLocaleTimeString()
                    : "recently"}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <IntegrityStatus
                status={integrity.status}
                totalEvents={integrity.totalEvents}
                headHash={integrity.headHash}
              />
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-1.5 pt-2 border-t border-zinc-800/80 overflow-x-auto text-xs no-scrollbar">
            {navTabs.map((tab) => {
              const isActive =
                tab.href === `/incidents/${incidentId}`
                  ? pathname === tab.href
                  : pathname.startsWith(tab.href);
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg font-medium transition-all whitespace-nowrap select-none ${
                    isActive
                      ? "bg-zinc-800 text-zinc-100 font-semibold shadow-sm border border-zinc-700/80"
                      : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60"
                  }`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">{children}</div>
    </div>
  );
}
