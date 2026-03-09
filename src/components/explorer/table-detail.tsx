"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useExplorerStore } from "@/stores/explorer-store";
import { TYPE_COLORS } from "@/lib/constants";
import type { TableDetail as TableDetailType, ColumnDetail } from "@/types";

interface TableDetailProps {
  tableName: string;
  onNavigateTable: (tableName: string) => void;
}

export function TableDetailView({
  tableName,
  onNavigateTable,
}: TableDetailProps) {
  const selectedSnapshotId = useExplorerStore((s) => s.selectedSnapshotId);
  const [tableDetail, setTableDetail] = useState<TableDetailType | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showInherited, setShowInherited] = useState(true);

  useEffect(() => {
    if (!selectedSnapshotId || !tableName) return;

    setLoading(true);
    setError(null);

    fetch(
      `/api/tables/${encodeURIComponent(tableName)}?snapshotId=${selectedSnapshotId}`
    )
      .then((res) => {
        if (res.status === 404)
          throw new Error(
            `Table "${tableName}" was not found in this snapshot. It may belong to a plugin or application scope that is not active on this instance.`
          );
        if (!res.ok) throw new Error("Failed to load table details");
        return res.json();
      })
      .then((data) => setTableDetail(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [selectedSnapshotId, tableName]);

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-96" />
        <div className="space-y-2 mt-6">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          {error}
        </div>
      </div>
    );
  }

  if (!tableDetail) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground p-8">
        Select a table to view its details
      </div>
    );
  }

  // Group columns: own vs inherited (by source table)
  const ownColumns = tableDetail.columns.filter(
    (c) => c.definedOnTable === tableName
  );

  // Build label lookup from inheritance chain
  const tableLabelMap = new Map<string, string>();
  for (const ancestor of tableDetail.inheritanceChain) {
    tableLabelMap.set(ancestor.name, ancestor.label);
  }

  // Group inherited columns in inheritance chain order
  const inheritedByTable = new Map<string, ColumnDetail[]>();
  for (const ancestor of tableDetail.inheritanceChain) {
    const cols = tableDetail.columns.filter(
      (c) => c.definedOnTable === ancestor.name
    );
    if (cols.length > 0) {
      inheritedByTable.set(ancestor.name, cols);
    }
  }

  return (
    <div className="p-6 overflow-auto">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold font-mono">{tableDetail.name}</h2>
        <p className="text-muted-foreground">{tableDetail.label}</p>

        {/* Metadata badges */}
        <div className="flex flex-wrap gap-2 mt-3">
          {tableDetail.scopeName && (
            <Badge variant="outline">Scope: {tableDetail.scopeLabel || tableDetail.scopeName}</Badge>
          )}
          {tableDetail.numberPrefix && (
            <Badge variant="outline">Prefix: {tableDetail.numberPrefix}</Badge>
          )}
          <Badge variant="secondary">
            {ownColumns.length} own columns
          </Badge>
          <Badge variant="secondary">
            {tableDetail.totalColumnCount} total columns
          </Badge>
          {tableDetail.childTableCount > 0 && (
            <Badge variant="secondary">
              {tableDetail.childTableCount} child tables
            </Badge>
          )}
        </div>

        {/* Inheritance chain */}
        {tableDetail.inheritanceChain.length > 0 && (
          <div className="mt-3 flex items-center gap-1 text-sm">
            <span className="text-muted-foreground">Extends:</span>
            {tableDetail.inheritanceChain.map((parent, i) => (
              <span key={parent.name} className="flex items-center gap-1">
                {i > 0 && <span className="text-muted-foreground">&rarr;</span>}
                <button
                  onClick={() => onNavigateTable(parent.name)}
                  className="text-primary hover:underline font-mono"
                >
                  {parent.label}
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Child tables */}
        {tableDetail.childTables.length > 0 && (
          <div className="mt-2 flex items-center gap-1 text-sm flex-wrap">
            <span className="text-muted-foreground">Extended by:</span>
            {tableDetail.childTables.map((child, i) => (
              <span key={child}>
                {i > 0 && <span className="text-muted-foreground">, </span>}
                <button
                  onClick={() => onNavigateTable(child)}
                  className="text-primary hover:underline font-mono"
                >
                  {child}
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <Separator className="my-4" />

      {/* Own columns */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-3">
          Own Columns ({ownColumns.length})
        </h3>
        <ColumnTable columns={ownColumns} onNavigateTable={onNavigateTable} />
      </div>

      {/* Inherited columns */}
      {inheritedByTable.size > 0 && (
        <Collapsible open={showInherited} onOpenChange={setShowInherited}>
          <CollapsibleTrigger className="flex items-center gap-2 text-lg font-semibold mb-3 hover:text-primary">
            <span>{showInherited ? "▾" : "▸"}</span>
            Inherited Columns ({tableDetail.columns.length - ownColumns.length})
          </CollapsibleTrigger>
          <CollapsibleContent>
            {Array.from(inheritedByTable.entries()).map(([source, columns]) => (
              <div key={source} className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm text-muted-foreground">From</span>
                  <button
                    onClick={() => onNavigateTable(source)}
                    className="text-sm text-primary hover:underline font-mono"
                  >
                    {tableLabelMap.get(source) || source}
                  </button>
                  <Badge variant="outline" className="text-xs">
                    {columns.length}
                  </Badge>
                </div>
                <ColumnTable
                  columns={columns}
                  onNavigateTable={onNavigateTable}
                />
              </div>
            ))}
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}

function ColumnTable({
  columns,
  onNavigateTable,
}: {
  columns: ColumnDetail[];
  onNavigateTable: (name: string) => void;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[200px]">Element</TableHead>
          <TableHead>Label</TableHead>
          <TableHead className="w-[120px]">Type</TableHead>
          <TableHead className="w-[150px]">Reference</TableHead>
          <TableHead className="w-[80px]">Length</TableHead>
          <TableHead className="w-[60px]">Req</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {columns.map((col) => (
          <TableRow key={col.element}>
            <TableCell className="font-mono text-sm">{col.element}</TableCell>
            <TableCell className="text-sm">{col.label}</TableCell>
            <TableCell>
              <Badge
                className={`text-[10px] ${TYPE_COLORS[col.internalType] || ""}`}
                variant="secondary"
              >
                {col.internalType}
              </Badge>
            </TableCell>
            <TableCell>
              {col.referenceTable && (
                <button
                  onClick={() => onNavigateTable(col.referenceTable!)}
                  className="text-sm text-primary hover:underline font-mono"
                >
                  {col.referenceTable}
                </button>
              )}
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {col.maxLength}
            </TableCell>
            <TableCell>
              {col.isMandatory && (
                <Badge variant="destructive" className="text-[10px] px-1 py-0">
                  req
                </Badge>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
