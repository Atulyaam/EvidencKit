"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Button,
  Input,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Alert,
  Breadcrumbs,
  BreadcrumbItem
} from "@evidencekit/ui";
import { ArrowLeft, ShieldPlus } from "lucide-react";

export default function NewIncidentPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<"critical" | "high" | "medium" | "low" | "info">("high");
  const [status, setStatus] = useState<"open" | "investigating">("open");
  const [environment, setEnvironment] = useState("production");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Incident title is required");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const res = await fetch("/api/incidents", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          severity,
          status,
          environment: environment.trim() || "production"
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to create incident");
      }

      const created = await res.json();
      router.push(`/incidents/${created.id}`);
    } catch (err: any) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      <Breadcrumbs>
        <BreadcrumbItem href="/">Home</BreadcrumbItem>
        <BreadcrumbItem href="/incidents">Incidents</BreadcrumbItem>
        <BreadcrumbItem isCurrentPage>New Incident</BreadcrumbItem>
      </Breadcrumbs>

      <Card className="border-zinc-800 bg-zinc-900/60 shadow-xl">
        <CardHeader className="border-b border-zinc-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-blue-950/60 border border-blue-800/60 text-blue-400">
              <ShieldPlus className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold text-white">Create New Incident</CardTitle>
              <CardDescription className="text-xs text-zinc-400 mt-1">
                Initialize an isolated incident reconstruction stream backed by an immutable SHA-256
                hash-chain.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <Alert variant="danger" title="Validation Error">
                {error}
              </Alert>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-300">
                Incident Title <span className="text-rose-400">*</span>
              </label>
              <Input
                type="text"
                placeholder="e.g. Production Database Failover & Connection Exhaustion"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-300">Description</label>
              <textarea
                rows={4}
                className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Briefly describe the symptoms, customer impact, or triggering alerts..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300">Severity</label>
                <select
                  value={severity}
                  onChange={(e: any) => setSeverity(e.target.value)}
                  className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                  <option value="info">Info</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300">Initial Status</label>
                <select
                  value={status}
                  onChange={(e: any) => setStatus(e.target.value)}
                  className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="open">Open</option>
                  <option value="investigating">Investigating</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300">Environment</label>
                <Input
                  type="text"
                  placeholder="production"
                  value={environment}
                  onChange={(e) => setEnvironment(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-zinc-800">
              <Link href="/incidents">
                <Button type="button" variant="ghost" size="sm" className="gap-1.5 text-zinc-400">
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Cancel</span>
                </Button>
              </Link>
              <Button type="submit" variant="primary" isLoading={submitting}>
                Create Incident
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
