"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Input, Card, CardHeader, CardTitle, CardContent } from "@evidencekit/ui";

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
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-2 text-xs text-zinc-400">
        <Link href="/incidents" className="hover:text-zinc-200">
          ← Back to Incidents
        </Link>
      </div>

      <Card className="border-zinc-800 bg-zinc-900/60 shadow-xl">
        <CardHeader className="border-b border-zinc-800 pb-4">
          <CardTitle className="text-xl font-bold text-white">Create New Incident</CardTitle>
          <p className="text-xs text-zinc-400 mt-1">
            Initialize an isolated incident reconstruction stream backed by an immutable hash-chain.
          </p>
        </CardHeader>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="rounded-lg border border-rose-900/60 bg-rose-950/30 p-3 text-xs text-rose-300">
                {error}
              </div>
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
                <label className="text-xs font-semibold text-zinc-300">Initial Severity</label>
                <select
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value as any)}
                  className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-blue-500 focus:outline-none"
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
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-blue-500 focus:outline-none"
                >
                  <option value="open">Open</option>
                  <option value="investigating">Investigating</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300">Target Environment</label>
                <Input
                  type="text"
                  placeholder="production"
                  value={environment}
                  onChange={(e) => setEnvironment(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-800">
              <Link href="/incidents">
                <Button variant="outline" type="button">
                  Cancel
                </Button>
              </Link>
              <Button variant="primary" type="submit" disabled={submitting}>
                {submitting ? "Initializing Stream..." : "Create Incident"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
