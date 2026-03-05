"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SnapshotSummary } from "@/types";

interface CatalogStats {
  totalEntries: number;
  definedCount: number;
  undefinedCount: number;
  stewardedCount: number;
  tableCount: number;
}

interface GenerateResult {
  created: number;
  updated: number;
  total: number;
  snapshotLabel: string;
}

export default function AdminCatalogPage() {
  const [snapshots, setSnapshots] = useState<SnapshotSummary[]>([]);
  const [stats, setStats] = useState<CatalogStats | null>(null);
  const [selectedSnapshotId, setSelectedSnapshotId] = useState("");
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/snapshots")
      .then((r) => r.json())
      .then((data: SnapshotSummary[]) => {
        const completed = data.filter((s) => s.status === "COMPLETED");
        setSnapshots(completed);
      })
      .catch(console.error);

    fetch("/api/catalog/stats")
      .then((r) => r.json())
      .then(setStats)
      .catch(console.error);
  }, []);

  const handleGenerate = async () => {
    if (!selectedSnapshotId) return;

    const snapshot = snapshots.find((s) => s.id === selectedSnapshotId);
    if (
      !confirm(
        `Generate catalog entries from "${snapshot?.label}"? This will create entries for new fields and update metadata for existing ones. Existing definitions and steward assignments will be preserved.`
      )
    ) {
      return;
    }

    setGenerating(true);
    setResult(null);
    setError(null);

    try {
      const res = await fetch("/api/admin/catalog/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snapshotId: selectedSnapshotId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to generate catalog");
      }
      const data = await res.json();
      setResult(data);

      // Refresh stats
      fetch("/api/catalog/stats")
        .then((r) => r.json())
        .then(setStats)
        .catch(console.error);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Catalog Management</h1>
        <Button variant="outline" asChild>
          <Link href="/catalog">View Catalog →</Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Generate section */}
        <Card>
          <CardHeader>
            <CardTitle>Generate Catalog</CardTitle>
            <CardDescription>
              Populate the data catalog from an ingested schema snapshot.
              Existing definitions and steward assignments are preserved.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">
                Schema Snapshot
              </label>
              <Select
                value={selectedSnapshotId}
                onValueChange={setSelectedSnapshotId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a snapshot..." />
                </SelectTrigger>
                <SelectContent>
                  {snapshots.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.label} ({s.tableCount} tables, {s.columnCount} columns)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={handleGenerate}
              disabled={!selectedSnapshotId || generating}
              className="w-full"
            >
              {generating ? "Generating..." : "Generate Catalog"}
            </Button>

            {result && (
              <div className="p-3 rounded-md bg-green-50 dark:bg-green-950 text-sm">
                <p className="font-medium text-green-800 dark:text-green-200">
                  Catalog generated from &ldquo;{result.snapshotLabel}&rdquo;
                </p>
                <p className="text-green-700 dark:text-green-300 mt-1">
                  {result.created} new entries created, {result.updated} existing
                  entries updated ({result.total} total fields processed)
                </p>
              </div>
            )}

            {error && (
              <div className="p-3 rounded-md bg-red-50 dark:bg-red-950 text-sm text-red-800 dark:text-red-200">
                {error}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stats section */}
        <Card>
          <CardHeader>
            <CardTitle>Catalog Stats</CardTitle>
            <CardDescription>
              Current state of the data catalog
            </CardDescription>
          </CardHeader>
          <CardContent>
            {stats ? (
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">
                    Total entries
                  </span>
                  <span className="font-medium">{stats.totalEntries}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">
                    With definitions
                  </span>
                  <span className="font-medium text-green-600">
                    {stats.definedCount}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">
                    Needs definition
                  </span>
                  <span className="font-medium text-amber-600">
                    {stats.undefinedCount}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">
                    With steward
                  </span>
                  <span className="font-medium">{stats.stewardedCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">
                    Tables covered
                  </span>
                  <span className="font-medium">{stats.tableCount}</span>
                </div>
                {stats.totalEntries > 0 && (
                  <div className="pt-2 border-t">
                    <div className="text-xs text-muted-foreground mb-1">
                      Definition coverage
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className="bg-green-600 h-2 rounded-full transition-all"
                        style={{
                          width: `${Math.round((stats.definedCount / stats.totalEntries) * 100)}%`,
                        }}
                      />
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {Math.round(
                        (stats.definedCount / stats.totalEntries) * 100
                      )}
                      % complete
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Loading stats...</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
