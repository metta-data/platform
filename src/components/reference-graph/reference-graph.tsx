"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useGraphStore } from "@/stores/graph-store";
import { useForceLayout } from "./use-force-layout";
import { useDragSimulation } from "./use-drag-simulation";
import { CanvasGraph } from "./canvas-graph";
import { FilterPanel } from "./filter-panel";
import { NodeInfoPanel } from "./node-info-panel";
import { EdgeInfoPanel } from "./edge-info-panel";
import type { ReferenceGraphResponse } from "@/types";

interface ReferenceGraphProps {
  snapshotId?: string | null;
  focusTable?: string | null;
}

export function ReferenceGraph({ snapshotId: propSnapshotId, focusTable: propFocusTable }: ReferenceGraphProps) {
  const {
    snapshotId: storeSnapshotId,
    graphData,
    loading,
    error,
    viewMode,
    showOrphans,
    hiddenScopes,
    showLabels,
    showHierarchy,
    searchQuery,
    focusTable,
    depth,
    direction,
    selectedNode,
    selectedEdge,
    linkDistance,
    chargeStrength,
    setGraphData,
    setLoading,
    setError,
    setFocusTable,
    setSelectedNode,
    setHoveredNode,
  } = useGraphStore();

  const snapshotId = propSnapshotId ?? storeSnapshotId;

  // Sync explorer's selectedTable → graph store's focusTable
  useEffect(() => {
    if (propFocusTable !== undefined) {
      setFocusTable(propFocusTable);
    }
  }, [propFocusTable, setFocusTable]);

  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 1200, height: 800 });

  // Track container size
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) {
        setContainerSize({ width, height });
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Fetch graph data when snapshotId changes
  useEffect(() => {
    if (!snapshotId) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/reference-graph?snapshotId=${encodeURIComponent(snapshotId)}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<ReferenceGraphResponse>;
      })
      .then((data) => {
        if (!cancelled) {
          setGraphData(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [snapshotId, setGraphData, setLoading, setError]);

  // Filter nodes (orphans + BFS depth from focus table)
  const filteredData = useMemo(() => {
    if (!graphData) return null;

    let filteredNodes = graphData.nodes;
    let filteredEdges = graphData.edges;

    if (!showOrphans) {
      filteredNodes = filteredNodes.filter((n) => !n.isOrphan);
    }

    // Scope filtering — hide nodes whose scope is in hiddenScopes
    if (hiddenScopes.size > 0) {
      filteredNodes = filteredNodes.filter((n) => {
        const scopeKey = n.scopeName ?? "__null__";
        return !hiddenScopes.has(scopeKey);
      });
    }

    let nodeSet = new Set(filteredNodes.map((n) => n.name));
    filteredEdges = filteredEdges.filter(
      (e) => nodeSet.has(e.source) && nodeSet.has(e.target)
    );

    // BFS traversal from focus table to limit depth
    // Direction controls which edges are traversed:
    //   "all"      — bidirectional (both source→target and target→source)
    //   "inbound"  — follow edges backward: who references the focus table?
    //   "outbound" — follow edges forward: what does the focus table reference?
    if (focusTable && depth !== "all" && nodeSet.has(focusTable)) {
      const adjacency = new Map<string, Set<string>>();
      for (const e of filteredEdges) {
        if (!adjacency.has(e.source)) adjacency.set(e.source, new Set());
        if (!adjacency.has(e.target)) adjacency.set(e.target, new Set());

        if (direction === "all" || direction === "outbound") {
          adjacency.get(e.source)!.add(e.target);
        }
        if (direction === "all" || direction === "inbound") {
          adjacency.get(e.target)!.add(e.source);
        }
      }

      const visited = new Set<string>();
      let frontier = [focusTable];
      for (let level = 0; level <= depth && frontier.length > 0; level++) {
        const nextFrontier: string[] = [];
        for (const name of frontier) {
          if (visited.has(name)) continue;
          visited.add(name);
          for (const neighbor of adjacency.get(name) ?? []) {
            if (!visited.has(neighbor)) nextFrontier.push(neighbor);
          }
        }
        frontier = nextFrontier;
      }

      filteredNodes = filteredNodes.filter((n) => visited.has(n.name));
      nodeSet = new Set(filteredNodes.map((n) => n.name));
      filteredEdges = filteredEdges.filter(
        (e) => nodeSet.has(e.source) && nodeSet.has(e.target)
      );
    }

    return { nodes: filteredNodes, edges: filteredEdges };
  }, [graphData, showOrphans, hiddenScopes, focusTable, depth, direction]);

  // Compute force layout in a Web Worker (non-blocking)
  const layoutOptions = useMemo(
    () => ({
      width: containerSize.width,
      height: containerSize.height,
      linkDistance,
      chargeStrength,
    }),
    [containerSize.width, containerSize.height, linkDistance, chargeStrength]
  );

  const { nodes: layoutNodes, edges: layoutEdges, computing } = useForceLayout(
    filteredData?.nodes ?? null,
    filteredData?.edges ?? null,
    layoutOptions
  );

  // Interactive drag simulation — activates on node drag, bounces connected nodes
  const {
    positionOverrides,
    onTickRef,
    onDragStart,
    onDrag,
    onDragStop,
  } = useDragSimulation(layoutNodes, layoutEdges, layoutOptions);

  // Find selected node data for info panel
  const selectedNodeData = useMemo(() => {
    if (!selectedNode || !graphData) return null;
    return graphData.nodes.find((n) => n.name === selectedNode) || null;
  }, [selectedNode, graphData]);

  // Find selected edge data for edge info panel
  // Edge IDs follow the pattern "source→target:type"
  const selectedEdgeData = useMemo(() => {
    if (!selectedEdge || !graphData) return null;
    return graphData.edges.find(
      (e) => `${e.source}→${e.target}:${e.type}` === selectedEdge
    ) || null;
  }, [selectedEdge, graphData]);

  const handleSelectNodeFromPanel = useCallback(
    (name: string) => {
      setSelectedNode(name);
      setHoveredNode(null);
    },
    [setSelectedNode, setHoveredNode]
  );

  if (!snapshotId) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        Select a snapshot to view the reference graph
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          Loading graph data...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center text-destructive">
        Error: {error}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="h-full w-full relative">
      <CanvasGraph
        nodes={layoutNodes}
        edges={layoutEdges}
        positionOverrides={positionOverrides}
        onTickRef={onTickRef}
        onDragStart={onDragStart}
        onDrag={onDrag}
        onDragStop={onDragStop}
        focusTable={focusTable}
        showLabels={showLabels}
        showFields={viewMode === "fields"}
        showHierarchy={showHierarchy}
        searchQuery={searchQuery}
      />

      {computing && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-20 pointer-events-none">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            Computing layout...
          </div>
        </div>
      )}

      <FilterPanel />

      {selectedNodeData && graphData && (
        <NodeInfoPanel
          node={selectedNodeData}
          edges={graphData.edges}
          onSelectNode={handleSelectNodeFromPanel}
        />
      )}

      {selectedEdgeData && (
        <EdgeInfoPanel
          edge={selectedEdgeData}
          onSelectNode={handleSelectNodeFromPanel}
        />
      )}
    </div>
  );
}
