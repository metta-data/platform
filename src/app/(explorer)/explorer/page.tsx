"use client";

import { useEffect, useState, useCallback } from "react";
import { SchemaTree } from "@/components/explorer/schema-tree";
import { TableDetailView } from "@/components/explorer/table-detail";
import { VersionSelector } from "@/components/explorer/version-selector";
import { ScopeFilter } from "@/components/explorer/scope-filter";
import { SearchBar } from "@/components/explorer/search-bar";
import { useExplorerStore } from "@/stores/explorer-store";
import type { SnapshotSummary } from "@/types";

export default function ExplorerPage() {
  const {
    selectedSnapshotId,
    selectedTable,
    setSelectedTable,
    setAvailableSnapshots,
  } = useExplorerStore();
  const [scopes, setScopes] = useState<
    { name: string; label: string; count: number }[]
  >([]);

  // Fetch available snapshots
  useEffect(() => {
    fetch("/api/snapshots")
      .then((res) => res.json())
      .then((data: SnapshotSummary[]) => setAvailableSnapshots(data))
      .catch(console.error);
  }, [setAvailableSnapshots]);

  // Fetch scopes when snapshot changes
  useEffect(() => {
    if (!selectedSnapshotId) return;
    fetch(`/api/scopes?snapshotId=${selectedSnapshotId}`)
      .then((res) => res.json())
      .then((data) => setScopes(data))
      .catch(console.error);
  }, [selectedSnapshotId]);

  const handleSelectTable = useCallback(
    (tableName: string) => {
      setSelectedTable(tableName);
    },
    [setSelectedTable]
  );

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b bg-muted/30">
        <VersionSelector />
        <ScopeFilter scopes={scopes} />
        <SearchBar />
        {selectedSnapshotId && (
          <span className="text-xs text-muted-foreground ml-auto">
            Click a table to view details
          </span>
        )}
      </div>

      {/* Main content: tree + detail */}
      <div className="flex flex-1 overflow-hidden">
        {/* Tree panel */}
        <div className="w-[380px] border-r overflow-hidden flex-shrink-0">
          <SchemaTree onSelectTable={handleSelectTable} />
        </div>

        {/* Detail panel */}
        <div className="flex-1 overflow-auto">
          {selectedTable ? (
            <TableDetailView
              tableName={selectedTable}
              onNavigateTable={handleSelectTable}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              Select a table from the tree to view its columns and relationships
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
