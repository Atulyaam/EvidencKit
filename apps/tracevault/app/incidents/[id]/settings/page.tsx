"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button, Input, Card, CardHeader, CardTitle, CardContent } from "@evidencekit/ui";

interface SettingsPageProps {
  params?: { id: string };
}

export default function IncidentSettingsPage({ params }: SettingsPageProps) {
  const router = useRouter();
  const routeParams = useParams();
  const incidentId = (routeParams?.id as string) || params?.id || "";

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<string>("high");
  const [status, setStatus] = useState<string>("open");
  const [environment, setEnvironment] = useState("production");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    async function fetchIncident() {
      try {
        setLoading(true);
        const res = await fetch(`/api/incidents/${incidentId}`);
        if (!res.ok) throw new Error("Failed to load incident");
        const data = await res.json();
        setTitle(data.title || "");
        setDescription(data.description || "");
        setSeverity(data.severity || "high");
        setStatus(data.status || "open");
        setEnvironment(data.environment || "production");
      } catch (err: any) {
        setMsg({ type: "error", text: err.message });
      } finally {
        setLoading(false);
      }
    }
    fetchIncident();
  }, [incidentId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setMsg(null);

      const res = await fetch(`/api/incidents/${incidentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description: description || undefined,
          severity,
          status,
          environment
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update incident");
      }

      setMsg({ type: "success", text: "Incident settings saved successfully." });
    } catch (err: any) {
      setMsg({ type: "error", text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (
      !window.confirm(
        "Are you sure you want to delete this incident? This action cannot be undone."
      )
    ) {
      return;
    }

    try {
      setDeleting(true);
      const res = await fetch(`/api/incidents/${incidentId}`, {
        method: "DELETE"
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to delete incident");
      }

      router.push("/incidents");
    } catch (err: any) {
      setMsg({ type: "error", text: err.message });
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-sm text-zinc-500 border border-zinc-800 rounded-lg bg-zinc-900/30">
        Loading settings...
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      {msg && (
        <div
          className={`p-3 rounded-lg text-xs font-medium border ${
            msg.type === "success"
              ? "bg-emerald-950/40 border-emerald-800/60 text-emerald-300"
              : "bg-rose-950/40 border-rose-800/60 text-rose-300"
          }`}
        >
          {msg.text}
        </div>
      )}

      {/* Metadata Editor */}
      <Card className="border-zinc-800 bg-zinc-900/50">
        <CardHeader className="pb-3 border-b border-zinc-800/80">
          <CardTitle className="text-base text-zinc-100">Incident Metadata</CardTitle>
          <p className="text-xs text-zinc-400 mt-0.5">
            Update operational parameters and lifecycle state.
          </p>
        </CardHeader>
        <CardContent className="pt-4">
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-300">Incident Title</label>
              <Input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-300">Description</label>
              <textarea
                rows={3}
                className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-blue-500 focus:outline-none"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300">Severity</label>
                <select
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value)}
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
                <label className="text-xs font-semibold text-zinc-300">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-blue-500 focus:outline-none"
                >
                  <option value="open">Open</option>
                  <option value="investigating">Investigating</option>
                  <option value="mitigated">Mitigated</option>
                  <option value="resolved">Resolved</option>
                  <option value="closed">Closed</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300">Environment</label>
                <Input
                  type="text"
                  value={environment}
                  onChange={(e) => setEnvironment(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <Button variant="primary" type="submit" disabled={saving}>
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Export Evidence Bundle */}
      <Card className="border-zinc-800 bg-zinc-900/50">
        <CardHeader className="pb-3 border-b border-zinc-800/80">
          <CardTitle className="text-base text-zinc-100">Export Portable Evidence Bundle</CardTitle>
          <p className="text-xs text-zinc-400 mt-0.5">
            Download the complete tamper-evident record including manifest, RFC 8785 chained events,
            and cryptographic signatures.
          </p>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          <p className="text-xs text-zinc-300 leading-relaxed">
            The exported bundle is fully portable and can be independently verified on any system
            without access to the TraceVault database or server.
          </p>

          <div className="flex flex-wrap gap-3">
            <a href={`/api/incidents/${incidentId}/export?format=json`} download>
              <Button variant="outline" size="sm">
                Export JSON Bundle (.json)
              </Button>
            </a>
            <a href={`/api/incidents/${incidentId}/export?format=zip`} download>
              <Button variant="outline" size="sm">
                Export ZIP Archive (.zip)
              </Button>
            </a>
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-rose-900/40 bg-rose-950/10">
        <CardHeader className="pb-3 border-b border-rose-900/30">
          <CardTitle className="text-base text-rose-400">Danger Zone</CardTitle>
        </CardHeader>
        <CardContent className="pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-sm font-semibold text-zinc-200 block">Delete this incident</span>
            <p className="text-xs text-zinc-400 mt-0.5">
              Permanently remove this incident metadata and unbind its evidence stream.
            </p>
          </div>
          <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleting}>
            {deleting ? "Deleting..." : "Delete Incident"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
