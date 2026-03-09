"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { SchemaTree } from "@/components/explorer/schema-tree";
import { TableDetailView } from "@/components/explorer/table-detail";
import { VersionSelector } from "@/components/explorer/version-selector";
import { ScopeFilter } from "@/components/explorer/scope-filter";
import { SearchBar } from "@/components/explorer/search-bar";
import { SchemaMap } from "@/components/schema-map/schema-map";
import { QueryBuilderPanel } from "@/components/schema-map/query-builder-panel";
import { useExplorerStore } from "@/stores/explorer-store";
import { Table2, Map } from "lucide-react";
import type { SnapshotSummary } from "@/types";

export default function ExplorerPage() {
  return (
    <Suspense>
      <ExplorerPageInner />
    </Suspense>
  );
}

function ExplorerPageInner() {
  const searchParams = useSearchParams();
  const {
    selectedSnapshotId,
    selectedTable,
    viewMode,
    setSelectedTable,
    setAvailableSnapshots,
    setViewMode,
  } = useExplorerStore();
  const [scopes, setScopes] = useState<
    { name: string; label: string; count: number }[]
  >([]);

  // Deep-link: if ?table= query param is present, select that table on mount
  useEffect(() => {
    const tableParam = searchParams.get("table");
    if (tableParam && tableParam !== selectedTable) {
      setSelectedTable(tableParam);
    }
    // Only run on mount / when searchParams change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

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

        <div className="ml-auto flex items-center gap-1">
          {/* View mode toggle */}
          <div className="flex items-center rounded-md border bg-background p-0.5">
            <button
              onClick={() => setViewMode("detail")}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                viewMode === "detail"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Table2 className="w-3.5 h-3.5" />
              Detail
            </button>
            <button
              onClick={() => setViewMode("map")}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                viewMode === "map"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Map className="w-3.5 h-3.5" />
              Schema Map
            </button>
          </div>
        </div>
      </div>

      {/* Main content: tree + detail/map */}
      <div className="flex flex-1 overflow-hidden">
        {/* Tree panel + Query Builder */}
        <div className="w-[380px] border-r overflow-hidden flex-shrink-0 flex flex-col">
          <div className="flex-1 overflow-hidden min-h-[200px]">
            <SchemaTree onSelectTable={handleSelectTable} />
          </div>
          {viewMode === "map" && selectedTable && (
            <>
              <div className="border-t" />
              <div className="h-[340px] flex-shrink-0 overflow-auto">
                <QueryBuilderPanel />
              </div>
            </>
          )}
        </div>

        {/* Right panel — switches between Detail and Schema Map */}
        <div className="flex-1 overflow-hidden">
          {viewMode === "detail" ? (
            <div className="h-full overflow-auto">
              {selectedTable ? (
                <TableDetailView
                  tableName={selectedTable}
                  onNavigateTable={handleSelectTable}
                />
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  Select a table from the tree to view its columns and
                  relationships
                </div>
              )}
            </div>
          ) : (
            <SchemaMap />
          )}
        </div>
      </div>
    </div>
  );
}
