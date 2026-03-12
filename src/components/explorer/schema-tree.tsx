"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Tree } from "react-arborist";
import { useExplorerStore } from "@/stores/explorer-store";
import { buildTree } from "@/lib/schema/tree-builder";
import { TreeNodeRenderer } from "./tree-node";
import { Skeleton } from "@/components/ui/skeleton";
import type { TreeTableNode, TreeNode as TreeNodeType } from "@/types";

interface SchemaTreeProps {
  onSelectTable: (tableName: string) => void;
}

export function SchemaTree({ onSelectTable }: SchemaTreeProps) {
  const { selectedSnapshotId, searchQuery, scopeFilter } = useExplorerStore();
  const [tables, setTables] = useState<TreeTableNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 400, height: 600 });

  useEffect(() => {
    if (!selectedSnapshotId) return;

    // eslint-disable-next-line react-hooks/set-state-in-effect -- data-fetching effect needs loading state
    setLoading(true);
    setError(null);

    const params = new URLSearchParams({ snapshotId: selectedSnapshotId });
    if (scopeFilter) params.set("scope", scopeFilter);

    fetch(`/api/tree?${params}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load tree data");
        return res.json();
      })
      .then((data) => setTables(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [selectedSnapshotId, scopeFilter]);

  const treeData = useMemo(() => buildTree(tables), [tables]);

  // Measure container
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const handleSelect = useCallback(
    (nodes: { id: string }[]) => {
      if (nodes.length > 0) {
        onSelectTable(nodes[0].id);
      }
    },
    [onSelectTable]
  );

  if (!selectedSnapshotId) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground p-8">
        Select a schema version to explore
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-4 space-y-2">
        {Array.from({ length: 20 }).map((_, i) => (
          <Skeleton key={i} className="h-6 w-full" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-destructive p-8">
        {error}
      </div>
    );
  }

  if (tables.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground p-8">
        No tables found
      </div>
    );
  }

  return (
    <div ref={containerRef} className="h-full w-full">
      <Tree<TreeNodeType>
        data={treeData}
        openByDefault={false}
        width={dimensions.width}
        height={dimensions.height}
        rowHeight={32}
        indent={20}
        searchTerm={searchQuery}
        searchMatch={(node, term) =>
          node.data.name.toLowerCase().includes(term.toLowerCase()) ||
          node.data.data.label.toLowerCase().includes(term.toLowerCase())
        }
        onSelect={handleSelect}
      >
        {TreeNodeRenderer}
      </Tree>
    </div>
  );
}
