"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface StaleEntry {
  tableName: string;
  element: string;
  currentValue: string;
  suggestedValue: string | null;
  resolvedBy: string;
}

interface UnresolvableEntry {
  tableName: string;
  element: string;
  currentValue: string;
}

interface DiagnoseResult {
  snapshotId: string;
  snapshotLabel: string;
  totalReferenceColumns: number;
  valid: number;
  stale: StaleEntry[];
  unresolvable: UnresolvableEntry[];
}

interface RepairResult {
  status: string;
  totalRefFieldsFetched: number;
  columnsChecked: number;
  columnsUpdated: number;
  columnsCorrected: number;
}

export function ReferenceHealthDialog({
  snapshotId,
  snapshotLabel,
  open,
  onOpenChange,
}: {
  snapshotId: string;
  snapshotLabel: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [diagnosis, setDiagnosis] = useState<DiagnoseResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [repairing, setRepairing] = useState(false);
  const [repairResult, setRepairResult] = useState<RepairResult | null>(null);
  const [repairError, setRepairError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setDiagnosis(null);
      setError(null);
      setRepairResult(null);
      setRepairError(null);
      return;
    }
    runDiagnosis();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, snapshotId]);

  async function runDiagnosis() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/snapshots/${snapshotId}/diagnose-references`
      );
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      setDiagnosis(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to diagnose");
    } finally {
      setLoading(false);
    }
  }

  async function handleRepair() {
    setRepairing(true);
    setRepairError(null);
    setRepairResult(null);
    try {
      const res = await fetch(
        `/api/snapshots/${snapshotId}/repair-references`,
        { method: "POST" }
      );
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      setRepairResult(await res.json());
      // Re-run diagnosis to show updated state
      await runDiagnosis();
    } catch (err) {
      setRepairError(err instanceof Error ? err.message : "Repair failed");
    } finally {
      setRepairing(false);
    }
  }

  const staleCount = diagnosis?.stale.length ?? 0;
  const unresolvableCount = diagnosis?.unresolvable.length ?? 0;
  const totalIssues = staleCount + unresolvableCount;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Reference Health — {snapshotLabel}</DialogTitle>
          <DialogDescription>
            Checks whether referenceTable values point to valid table names.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4">
          {loading && (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Scanning {snapshotLabel} references...
            </p>
          )}

          {error && (
            <div className="p-3 rounded-md bg-red-50 dark:bg-red-950 text-red-800 dark:text-red-200 text-sm">
              {error}
            </div>
          )}

          {diagnosis && !loading && (
            <>
              {/* Summary */}
              <div className="flex items-center gap-3 flex-wrap">
                <Badge variant="outline">
                  {diagnosis.totalReferenceColumns.toLocaleString()} reference
                  columns
                </Badge>
                <Badge
                  variant="default"
                  className="bg-green-600 hover:bg-green-600"
                >
                  {diagnosis.valid.toLocaleString()} valid
                </Badge>
                {staleCount > 0 && (
                  <Badge variant="destructive">
                    {staleCount.toLocaleString()} stale
                  </Badge>
                )}
                {unresolvableCount > 0 && (
                  <Badge variant="secondary">
                    {unresolvableCount.toLocaleString()} unresolvable
                  </Badge>
                )}
              </div>

              {/* Repair result */}
              {repairResult && (
                <div className="p-3 rounded-md bg-green-50 dark:bg-green-950 text-sm">
                  <p className="font-medium text-green-800 dark:text-green-200">
                    Repair complete
                  </p>
                  <p className="text-green-700 dark:text-green-300 mt-1">
                    {repairResult.columnsCorrected.toLocaleString()} columns
                    corrected out of{" "}
                    {repairResult.columnsChecked.toLocaleString()} checked.
                  </p>
                </div>
              )}

              {repairError && (
                <div className="p-3 rounded-md bg-red-50 dark:bg-red-950 text-red-800 dark:text-red-200 text-sm">
                  {repairError}
                </div>
              )}

              {/* All clear */}
              {totalIssues === 0 && !repairResult && (
                <div className="p-3 rounded-md bg-green-50 dark:bg-green-950 text-sm">
                  <p className="font-medium text-green-800 dark:text-green-200">
                    All references valid
                  </p>
                  <p className="text-green-700 dark:text-green-300 mt-1">
                    Every referenceTable value points to a known table name.
                  </p>
                </div>
              )}

              {/* Stale entries table */}
              {staleCount > 0 && (
                <div className="border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Table</TableHead>
                        <TableHead>Column</TableHead>
                        <TableHead>Current</TableHead>
                        <TableHead>Suggested</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {diagnosis.stale.slice(0, 100).map((entry, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-xs font-mono">
                            {entry.tableName}
                          </TableCell>
                          <TableCell className="text-xs font-mono">
                            {entry.element}
                          </TableCell>
                          <TableCell className="text-xs text-destructive">
                            {entry.currentValue}
                          </TableCell>
                          <TableCell className="text-xs text-green-700 dark:text-green-400">
                            {entry.suggestedValue}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {staleCount > 100 && (
                    <p className="text-xs text-muted-foreground px-4 py-2 border-t">
                      Showing 100 of {staleCount.toLocaleString()} stale
                      entries.
                    </p>
                  )}
                </div>
              )}

              {/* Unresolvable entries */}
              {unresolvableCount > 0 && (
                <div className="border rounded-md">
                  <p className="text-xs font-medium px-4 py-2 border-b text-muted-foreground">
                    Unresolvable ({unresolvableCount})
                  </p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Table</TableHead>
                        <TableHead>Column</TableHead>
                        <TableHead>Current Value</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {diagnosis.unresolvable.slice(0, 50).map((entry, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-xs font-mono">
                            {entry.tableName}
                          </TableCell>
                          <TableCell className="text-xs font-mono">
                            {entry.element}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {entry.currentValue}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer with repair button */}
        {diagnosis && staleCount > 0 && (
          <div className="flex items-center justify-between pt-4 border-t">
            <p className="text-sm text-muted-foreground">
              Repair will re-resolve {staleCount.toLocaleString()} stale
              references from ServiceNow.
            </p>
            <Button onClick={handleRepair} disabled={repairing}>
              {repairing ? "Repairing..." : "Repair References"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
