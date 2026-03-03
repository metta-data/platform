"use client";

import { useEffect, useState } from "react";
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

  const fetchSnapshots = () => {
    // Fetch all snapshots (not just completed)
    fetch("/api/snapshots/all")
      .then((r) => r.json())
      .then(setSnapshots)
      .catch(() => {
        // Fallback to regular endpoint
        fetch("/api/snapshots")
          .then((r) => r.json())
          .then(setSnapshots)
          .catch(console.error);
      });
  };

  useEffect(() => {
    fetchSnapshots();
    fetch("/api/instances")
      .then((r) => r.json())
      .then(setInstances)
      .catch(console.error);
  }, []);

  const handleCreateAndIngest = async () => {
    if (!form.label || !form.instanceId) return;
    setSaving(true);

    try {
      // Create snapshot
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

      // Trigger ingestion
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

      // Poll for updates
      const pollInterval = setInterval(() => {
        fetchSnapshots();
      }, 5000);
      setTimeout(() => clearInterval(pollInterval), 300000); // Stop after 5 min
      fetchSnapshots();
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
                  <TableCell>{statusBadge(snap.status)}</TableCell>
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
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(snap.id)}
                    >
                      Delete
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
