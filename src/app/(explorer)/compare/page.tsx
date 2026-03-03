"use client";

import { useEffect, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
  SnapshotSummary,
  ComparisonResult,
  TableModification,
} from "@/types";

export default function ComparePage() {
  const [snapshots, setSnapshots] = useState<SnapshotSummary[]>([]);
  const [baselineId, setBaselineId] = useState<string>("");
  const [targetId, setTargetId] = useState<string>("");
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Upload state
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadLabel, setUploadLabel] = useState("");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetch("/api/snapshots")
      .then((res) => res.json())
      .then((data) => setSnapshots(data))
      .catch(console.error);
  }, []);

  const handleCompare = async () => {
    if (!baselineId || !targetId) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baselineSnapshotId: baselineId,
          targetSnapshotId: targetId,
        }),
      });

      if (!res.ok) throw new Error("Comparison failed");
      const data = await res.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Comparison failed");
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async () => {
    if (!uploadFile || !uploadLabel) return;
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", uploadFile);
      formData.append("label", uploadLabel);
      formData.append("format", "json");

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();

      // Refresh snapshots list
      const snapshotsRes = await fetch("/api/snapshots");
      const newSnapshots = await snapshotsRes.json();
      setSnapshots(newSnapshots);
      setTargetId(data.snapshotId);
      setUploadFile(null);
      setUploadLabel("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Compare Schemas</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Baseline selection */}
        <Card>
          <CardHeader>
            <CardTitle>Baseline</CardTitle>
            <CardDescription>
              The reference schema (usually out-of-the-box)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={baselineId} onValueChange={setBaselineId}>
              <SelectTrigger>
                <SelectValue placeholder="Select baseline..." />
              </SelectTrigger>
              <SelectContent>
                {snapshots.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.label} ({s.tableCount} tables)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Target selection */}
        <Card>
          <CardHeader>
            <CardTitle>Target</CardTitle>
            <CardDescription>
              The schema to compare against the baseline
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="existing">
              <TabsList className="mb-3">
                <TabsTrigger value="existing">Existing Snapshot</TabsTrigger>
                <TabsTrigger value="upload">Upload</TabsTrigger>
              </TabsList>

              <TabsContent value="existing">
                <Select value={targetId} onValueChange={setTargetId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select target..." />
                  </SelectTrigger>
                  <SelectContent>
                    {snapshots.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.label} ({s.tableCount} tables)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TabsContent>

              <TabsContent value="upload">
                <div className="space-y-3">
                  <Input
                    placeholder="Label (e.g., My Instance)"
                    value={uploadLabel}
                    onChange={(e) => setUploadLabel(e.target.value)}
                  />
                  <Input
                    type="file"
                    accept=".json"
                    onChange={(e) =>
                      setUploadFile(e.target.files?.[0] || null)
                    }
                  />
                  <Button
                    onClick={handleUpload}
                    disabled={!uploadFile || !uploadLabel || uploading}
                    className="w-full"
                  >
                    {uploading ? "Uploading..." : "Upload & Process"}
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      <Button
        onClick={handleCompare}
        disabled={!baselineId || !targetId || loading}
        size="lg"
        className="w-full mb-8"
      >
        {loading ? "Comparing..." : "Compare Schemas"}
      </Button>

      {error && (
        <div className="text-destructive text-center mb-6">{error}</div>
      )}

      {loading && (
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      )}

      {result && <ComparisonResults result={result} />}
    </div>
  );
}

function ComparisonResults({ result }: { result: ComparisonResult }) {
  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard
          title="Added Tables"
          count={result.summary.addedTableCount}
          variant="added"
        />
        <SummaryCard
          title="Removed Tables"
          count={result.summary.removedTableCount}
          variant="removed"
        />
        <SummaryCard
          title="Modified Tables"
          count={result.summary.modifiedTableCount}
          variant="modified"
        />
        <SummaryCard
          title="Unchanged"
          count={result.unchangedTableCount}
          variant="unchanged"
        />
      </div>

      {/* Added tables */}
      {result.addedTables.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-green-700 dark:text-green-400">
              Added Tables ({result.addedTables.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Table Name</TableHead>
                  <TableHead>Label</TableHead>
                  <TableHead>Columns</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.addedTables.map((t) => (
                  <TableRow key={t.name} className="bg-green-50 dark:bg-green-950/20">
                    <TableCell className="font-mono">{t.name}</TableCell>
                    <TableCell>{t.label}</TableCell>
                    <TableCell>{t.columnCount}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Removed tables */}
      {result.removedTables.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-red-700 dark:text-red-400">
              Removed Tables ({result.removedTables.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Table Name</TableHead>
                  <TableHead>Label</TableHead>
                  <TableHead>Columns</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.removedTables.map((t) => (
                  <TableRow key={t.name} className="bg-red-50 dark:bg-red-950/20">
                    <TableCell className="font-mono line-through">
                      {t.name}
                    </TableCell>
                    <TableCell className="line-through">{t.label}</TableCell>
                    <TableCell>{t.columnCount}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Modified tables */}
      {result.modifiedTables.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-yellow-700 dark:text-yellow-400">
              Modified Tables ({result.modifiedTables.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {result.modifiedTables.map((mod) => (
                <ModifiedTableRow key={mod.tableName} modification={mod} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SummaryCard({
  title,
  count,
  variant,
}: {
  title: string;
  count: number;
  variant: "added" | "removed" | "modified" | "unchanged";
}) {
  const colors = {
    added: "border-green-500 bg-green-50 dark:bg-green-950/20",
    removed: "border-red-500 bg-red-50 dark:bg-red-950/20",
    modified: "border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20",
    unchanged: "border-muted bg-muted/20",
  };

  return (
    <Card className={`border-l-4 ${colors[variant]}`}>
      <CardContent className="pt-4">
        <div className="text-3xl font-bold">{count}</div>
        <div className="text-sm text-muted-foreground">{title}</div>
      </CardContent>
    </Card>
  );
}

function ModifiedTableRow({
  modification,
}: {
  modification: TableModification;
}) {
  const [open, setOpen] = useState(false);
  const totalChanges =
    modification.addedColumns.length +
    modification.removedColumns.length +
    modification.modifiedColumns.length;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center gap-3 w-full p-3 rounded-md hover:bg-accent text-left">
        <span>{open ? "▾" : "▸"}</span>
        <span className="font-mono font-medium">{modification.tableName}</span>
        <span className="text-sm text-muted-foreground">
          {modification.tableLabel}
        </span>
        <div className="ml-auto flex gap-1">
          {modification.addedColumns.length > 0 && (
            <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
              +{modification.addedColumns.length}
            </Badge>
          )}
          {modification.removedColumns.length > 0 && (
            <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
              -{modification.removedColumns.length}
            </Badge>
          )}
          {modification.modifiedColumns.length > 0 && (
            <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
              ~{modification.modifiedColumns.length}
            </Badge>
          )}
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="ml-6 mt-2 space-y-3 pb-3">
          {modification.addedColumns.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-green-700 dark:text-green-400 mb-1">
                Added Columns
              </h4>
              {modification.addedColumns.map((c) => (
                <div key={c.element} className="text-sm pl-4 py-0.5">
                  <span className="font-mono">{c.element}</span>
                  <span className="text-muted-foreground ml-2">
                    ({c.internalType})
                  </span>
                </div>
              ))}
            </div>
          )}
          {modification.removedColumns.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-red-700 dark:text-red-400 mb-1">
                Removed Columns
              </h4>
              {modification.removedColumns.map((c) => (
                <div key={c.element} className="text-sm pl-4 py-0.5 line-through">
                  <span className="font-mono">{c.element}</span>
                  <span className="text-muted-foreground ml-2">
                    ({c.internalType})
                  </span>
                </div>
              ))}
            </div>
          )}
          {modification.modifiedColumns.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-yellow-700 dark:text-yellow-400 mb-1">
                Modified Columns
              </h4>
              {modification.modifiedColumns.map((c) => (
                <div key={c.element} className="text-sm pl-4 py-0.5">
                  <span className="font-mono">{c.element}</span>
                  <div className="pl-4 text-xs">
                    {c.changes.map((change) => (
                      <div key={change.field}>
                        <span className="text-muted-foreground">
                          {change.field}:
                        </span>{" "}
                        <span className="text-red-600 dark:text-red-400 line-through">
                          {change.oldValue || "null"}
                        </span>{" "}
                        &rarr;{" "}
                        <span className="text-green-600 dark:text-green-400">
                          {change.newValue || "null"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
