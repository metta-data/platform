"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ReferenceHealthDialog } from "@/components/admin/reference-health-dialog";

interface Snapshot {
  id: string;
  label: string;
  version: string | null;
  description: string | null;
  status: string;
  sourceType: string;
  tableCount: number;
  columnCount: number;
  isBaseline: boolean;
  createdAt: string;
  errorMessage: string | null;
}

interface Instance {
  id: string;
  name: string;
  url: string;
}

interface ProgressEvent {
  phase: string;
  current: number;
  total: number;
  message: string;
}

const ACTIVE_STATUSES = new Set([
  "PENDING",
  "INGESTING_TABLES",
  "INGESTING_COLUMNS",
  "PROCESSING",
]);

function isActive(status: string) {
  return ACTIVE_STATUSES.has(status);
}

function ProgressBar({ current, total }: { current: number; total: number }) {
  const pct = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;
  return (
    <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
      <div
        className="bg-primary h-full rounded-full transition-all duration-300 ease-out"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function ProgressDisplay({ snapshotId }: { snapshotId: string }) {
  const [progress, setProgress] = useState<ProgressEvent | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const es = new EventSource(`/api/ingest/progress/${snapshotId}`);
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const data: ProgressEvent = JSON.parse(event.data);
        setProgress(data);
      } catch {
        // Ignore parse errors
      }
    };

    es.onerror = () => {
      // Connection lost — EventSource auto-reconnects
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [snapshotId]);

  if (!progress) {
    return (
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">Connecting...</p>
      </div>
    );
  }

  const phaseLabels: Record<string, string> = {
    waiting: "Waiting to start",
    tables: "Fetching tables",
    columns: "Fetching columns",
    processing: "Computing statistics",
    complete: "Complete",
    error: "Failed",
  };

  const phaseLabel = phaseLabels[progress.phase] || progress.phase;
  const showBar = progress.total > 0 && progress.phase !== "complete" && progress.phase !== "error";
  const showCount = progress.total > 0;

  return (
    <div className="space-y-1.5 min-w-[200px]">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-medium">{phaseLabel}</span>
        {showCount && (
          <span className="text-xs text-muted-foreground tabular-nums">
            {progress.current.toLocaleString()} / {progress.total.toLocaleString()}
          </span>
        )}
      </div>
      {showBar && (
        <ProgressBar current={progress.current} total={progress.total} />
      )}
      {progress.phase === "processing" && (
        <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
          <div className="bg-primary h-full rounded-full w-full animate-pulse" />
        </div>
      )}
    </div>
  );
}

export default function SnapshotsPage() {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [instances, setInstances] = useState<Instance[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    label: "",
    version: "",
    description: "",
    instanceId: "",
    isBaseline: true,
  });
  const [saving, setSaving] = useState(false);
  const [healthSnapshotId, setHealthSnapshotId] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchSnapshots = useCallback(() => {
    fetch("/api/snapshots/all")
      .then((r) => r.json())
      .then((data: Snapshot[]) => {
        setSnapshots(data);
        // Auto-stop polling when no active ingestions
        const hasActive = data.some((s) => isActive(s.status));
        if (!hasActive && pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
      })
      .catch(() => {
        fetch("/api/snapshots")
          .then((r) => r.json())
          .then(setSnapshots)
          .catch(console.error);
      });
  }, []);

  // Start polling for snapshot status updates (to catch status transitions)
  const startPolling = useCallback(() => {
    if (pollRef.current) return; // Already polling
    pollRef.current = setInterval(fetchSnapshots, 10000); // 10s for status updates
  }, [fetchSnapshots]);

  useEffect(() => {
    fetchSnapshots();
    fetch("/api/instances")
      .then((r) => r.json())
      .then(setInstances)
      .catch(console.error);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchSnapshots]);

  // Start polling if there are active snapshots
  useEffect(() => {
    const hasActive = snapshots.some((s) => isActive(s.status));
    if (hasActive) {
      startPolling();
    }
  }, [snapshots, startPolling]);

  const handleCreateAndIngest = async () => {
    if (!form.label || !form.instanceId) return;
    setSaving(true);

    try {
      const snapRes = await fetch("/api/snapshots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: form.label,
          version: form.version || null,
          description: form.description || null,
          instanceId: form.instanceId,
          isBaseline: form.isBaseline,
        }),
      });

      if (!snapRes.ok) throw new Error("Failed to create snapshot");
      const snapshot = await snapRes.json();

      await fetch("/api/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          snapshotId: snapshot.id,
          instanceId: form.instanceId,
        }),
      });

      setDialogOpen(false);
      setForm({
        label: "",
        version: "",
        description: "",
        instanceId: "",
        isBaseline: true,
      });

      fetchSnapshots();
      startPolling();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this snapshot?")) return;
    await fetch(`/api/snapshots/${id}`, { method: "DELETE" });
    fetchSnapshots();
  };

  const statusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      COMPLETED: "default",
      PENDING: "outline",
      INGESTING_TABLES: "secondary",
      INGESTING_COLUMNS: "secondary",
      PROCESSING: "secondary",
      FAILED: "destructive",
    };
    return (
      <Badge variant={variants[status] || "outline"}>
        {status.toLowerCase().replace(/_/g, " ")}
      </Badge>
    );
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Schema Snapshots</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>New Ingestion</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Ingest Schema from Instance</DialogTitle>
              <DialogDescription>
                Pull the full schema from a ServiceNow instance.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <label className="text-sm font-medium">Label</label>
                <Input
                  placeholder="e.g., Xanadu, Yokohama"
                  value={form.label}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, label: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="text-sm font-medium">
                  Version (optional)
                </label>
                <Input
                  placeholder="e.g., Xanadu Patch 3"
                  value={form.version}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, version: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="text-sm font-medium">Instance</label>
                <Select
                  value={form.instanceId}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, instanceId: v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select instance..." />
                  </SelectTrigger>
                  <SelectContent>
                    {instances.map((inst) => (
                      <SelectItem key={inst.id} value={inst.id}>
                        {inst.name} ({inst.url})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isBaseline"
                  checked={form.isBaseline}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, isBaseline: e.target.checked }))
                  }
                />
                <label htmlFor="isBaseline" className="text-sm">
                  Mark as baseline (OOB) schema
                </label>
              </div>
              <Button
                onClick={handleCreateAndIngest}
                disabled={saving || !form.label || !form.instanceId}
                className="w-full"
              >
                {saving ? "Starting..." : "Start Ingestion"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {snapshots.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No snapshots yet. Create one by ingesting from a ServiceNow
            instance.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Label</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Tables</TableHead>
                <TableHead>Columns</TableHead>
                <TableHead>Baseline</TableHead>
                <TableHead>Created</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {snapshots.map((snap) => (
                <TableRow key={snap.id}>
                  <TableCell className="font-medium">
                    <div>
                      {snap.label}
                      {snap.version && (
                        <span className="text-muted-foreground ml-1">
                          ({snap.version})
                        </span>
                      )}
                    </div>
                    {snap.status === "FAILED" && snap.errorMessage && (
                      <p className="text-xs text-destructive mt-1 font-normal max-w-[400px]">
                        {snap.errorMessage}
                      </p>
                    )}
                  </TableCell>
                  <TableCell>
                    {isActive(snap.status) ? (
                      <ProgressDisplay snapshotId={snap.id} />
                    ) : (
                      statusBadge(snap.status)
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {snap.sourceType?.replace(/_/g, " ").toLowerCase()}
                  </TableCell>
                  <TableCell>{snap.tableCount.toLocaleString()}</TableCell>
                  <TableCell>{snap.columnCount.toLocaleString()}</TableCell>
                  <TableCell>
                    {snap.isBaseline && <Badge variant="outline">OOB</Badge>}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(snap.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {snap.status === "COMPLETED" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setHealthSnapshotId(snap.id)}
                        >
                          References
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(snap.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {healthSnapshotId && (
        <ReferenceHealthDialog
          snapshotId={healthSnapshotId}
          snapshotLabel={
            snapshots.find((s) => s.id === healthSnapshotId)?.label ?? ""
          }
          open={!!healthSnapshotId}
          onOpenChange={(open) => {
            if (!open) setHealthSnapshotId(null);
          }}
        />
      )}
    </div>
  );
}
