"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  MiniMap,
  Background,
  BackgroundVariant,
  useReactFlow,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useExplorerStore } from "@/stores/explorer-store";
import type { GraphResponse } from "@/types/graph";
import { TableNode } from "./table-node";
import { MiniNode } from "./mini-node";
import { InheritanceEdge, ReferenceEdge } from "./custom-edges";
import { computeLayout } from "./layout";
import { MapToolbar } from "./map-toolbar";

const nodeTypes = {
  tableNode: TableNode,
  miniNode: MiniNode,
};

const edgeTypes = {
  inheritance: InheritanceEdge,
  reference: ReferenceEdge,
};

function SchemaMapInner() {
  const { selectedSnapshotId, selectedTable, setSelectedTable } =
    useExplorerStore();
  const { fitView } = useReactFlow();

  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [centerTable, setCenterTable] = useState<string | null>(null);
  const [depth, setDepth] = useState(2);
  const [showRefs, setShowRefs] = useState(true);
  const [direction, setDirection] = useState<"TB" | "LR">("TB");
  const [loading, setLoading] = useState(false);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  const abortRef = useRef<AbortController | null>(null);

  // Sync centerTable with selectedTable from tree
  useEffect(() => {
    if (selectedTable && selectedTable !== centerTable) {
      setCenterTable(selectedTable);
      setExpandedNodes(new Set());
    }
  }, [selectedTable, centerTable]);

  // Handlers passed to nodes — defined before the effect that uses them
  const handleToggleExpand = useCallback(
    (nodeId: string) => {
      setExpandedNodes((prev) => {
        const next = new Set(prev);
        if (next.has(nodeId)) {
          next.delete(nodeId);
        } else {
          next.add(nodeId);
        }
        return next;
      });

      // Update node data to trigger re-render
      setNodes((prev) =>
        prev.map((n) => {
          if (n.id === nodeId) {
            return {
              ...n,
              data: {
                ...n.data,
                expanded: !n.data.expanded,
              },
            };
          }
          return n;
        })
      );
    },
    []
  );

  const handleRecenter = useCallback(
    (tableName: string) => {
      setCenterTable(tableName);
      setSelectedTable(tableName);
      setExpandedNodes(new Set());
    },
    [setSelectedTable]
  );

  // Fetch graph data
  useEffect(() => {
    if (!selectedSnapshotId || !centerTable) {
      setNodes([]);
      setEdges([]);
      return;
    }

    // Cancel previous request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);

    const params = new URLSearchParams({
      snapshotId: selectedSnapshotId,
      centerTable,
      depth: String(depth),
      includeRefs: String(showRefs),
    });

    fetch(`/api/graph?${params}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((data: GraphResponse) => {
        if (controller.signal.aborted) return;

        // Convert to React Flow nodes — use tableNode for detailed, miniNode for others
        const rfNodes: Node[] = data.nodes.map((n) => ({
          id: n.name,
          type: n.isDetailed ? "tableNode" : "miniNode",
          position: { x: 0, y: 0 }, // Will be computed by layout
          data: {
            label: n.label,
            name: n.name,
            scopeName: n.scopeName,
            scopeLabel: n.scopeLabel,
            ownColumnCount: n.ownColumnCount,
            totalColumnCount: n.totalColumnCount,
            childTableCount: n.childTableCount,
            isCenter: n.isCenter,
            isTruncated: n.isTruncated,
            isDetailed: n.isDetailed,
            expanded: expandedNodes.has(n.name),
            columnCount: n.ownColumnCount,
            snapshotId: selectedSnapshotId,
            onToggleExpand: handleToggleExpand,
            onDoubleClick: handleRecenter,
          },
        }));

        // Convert to React Flow edges — assign handles based on layout direction
        // Inheritance flows with the direction (TB: top→bottom, LR: left→right)
        // Reference edges flow perpendicular to the hierarchy direction
        const inhSource = direction === "TB" ? "bottom" : "right";
        const inhTarget = direction === "TB" ? "top" : "left";
        const refSource = direction === "TB" ? "right" : "bottom";
        const refTarget = direction === "TB" ? "left" : "top";

        const rfEdges: Edge[] = data.edges.map((e, i) => ({
          id: `${e.source}-${e.target}-${e.type}-${i}`,
          source: e.source,
          target: e.target,
          type: e.type,
          data: { type: e.type, label: e.label },
          animated: e.type === "reference",
          sourceHandle: e.type === "inheritance" ? inhSource : refSource,
          targetHandle: e.type === "inheritance" ? inhTarget : refTarget,
        }));

        // Run layout
        const { nodes: layoutNodes, edges: layoutEdges } = computeLayout(
          rfNodes,
          rfEdges,
          direction
        );

        setNodes(layoutNodes);
        setEdges(layoutEdges);

        // Fit view after layout
        requestAnimationFrame(() => {
          fitView({ padding: 0.15, duration: 300 });
        });
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          console.error("Failed to fetch graph:", err);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSnapshotId, centerTable, depth, showRefs, direction]);

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      setSelectedTable(node.id);
    },
    [setSelectedTable]
  );

  const handleFitView = useCallback(() => {
    fitView({ padding: 0.15, duration: 300 });
  }, [fitView]);

  const handleSearch = useCallback(
    (tableName: string) => {
      setCenterTable(tableName);
      setSelectedTable(tableName);
      setExpandedNodes(new Set());
    },
    [setSelectedTable]
  );

  // Custom marker definition for reference arrows
  const markerDefs = useMemo(
    () => (
      <svg style={{ position: "absolute", width: 0, height: 0 }}>
        <defs>
          <marker
            id="reference-arrow"
            viewBox="0 0 10 10"
            refX="10"
            refY="5"
            markerWidth="8"
            markerHeight="8"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#3b82f6" />
          </marker>
        </defs>
      </svg>
    ),
    []
  );

  if (!selectedSnapshotId) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Select a schema version to explore
      </div>
    );
  }

  if (!centerTable) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Select a table from the tree to visualize its relationships
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <MapToolbar
        depth={depth}
        onDepthChange={setDepth}
        showRefs={showRefs}
        onToggleRefs={() => setShowRefs((v) => !v)}
        direction={direction}
        onDirectionChange={setDirection}
        onFitView={handleFitView}
        onSearch={handleSearch}
      />

      <div className="flex-1 relative">
        {markerDefs}
        {loading && (
          <div className="absolute inset-0 bg-background/50 z-10 flex items-center justify-center">
            <div className="text-sm text-muted-foreground animate-pulse">
              Loading graph...
            </div>
          </div>
        )}
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodeClick={handleNodeClick}
          fitView
          fitViewOptions={{ padding: 0.15 }}
          minZoom={0.05}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
          defaultEdgeOptions={{
            type: "inheritance",
          }}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
          <MiniMap
            nodeStrokeWidth={3}
            className="!bg-muted/50 !border !rounded-lg"
            maskColor="rgba(0,0,0,0.1)"
          />
        </ReactFlow>
      </div>
    </div>
  );
}

export function SchemaMap() {
  return (
    <ReactFlowProvider>
      <SchemaMapInner />
    </ReactFlowProvider>
  );
}
