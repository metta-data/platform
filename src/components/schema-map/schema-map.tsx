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
import type { GraphResponse, GraphEdge } from "@/types/graph";
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

// ---------------------------------------------------------------------------
// Edge-building helpers
// ---------------------------------------------------------------------------

function buildEdgesFromGraphData(
  graphEdges: GraphEdge[],
  includedNames: Set<string>,
  refTargetSet: Set<string>,
  expandedNodes: Set<string>,
  expandedGroups: Map<string, Set<string>>,
  columnsLoadedNodes: Set<string>,
  direction: "TB" | "LR"
): Edge[] {
  const inhSource = direction === "TB" ? "bottom" : "right";
  const inhTarget = direction === "TB" ? "top" : "left";

  const result: Edge[] = [];
  let edgeIdx = 0;

  for (const e of graphEdges) {
    if (!includedNames.has(e.source) || !includedNames.has(e.target)) continue;

    // --- Inheritance edges ---
    if (e.type === "inheritance") {
      result.push({
        id: `${e.source}-${e.target}-inh-${edgeIdx++}`,
        source: e.source,
        target: e.target,
        type: "inheritance",
        data: { type: "inheritance", label: e.label },
        animated: false,
        sourceHandle: inhSource,
        targetHandle: inhTarget,
      });
      continue;
    }

    // --- Reference edges ---
    const targetIsRefOnly = refTargetSet.has(e.target);
    const targetHandle = targetIsRefOnly ? "left" : "right-target";

    const isSourceExpanded =
      expandedNodes.has(e.source) && columnsLoadedNodes.has(e.source);

    if (!isSourceExpanded || !e.fields) {
      // Collapsed: single edge with label, generic right handle
      result.push({
        id: `${e.source}-${e.target}-ref-${edgeIdx++}`,
        source: e.source,
        target: e.target,
        type: "reference",
        data: { type: "reference", label: e.label },
        animated: true,
        sourceHandle: "right",
        targetHandle,
      });
      continue;
    }

    // Expanded: split by group / field
    const nodeGroups = expandedGroups.get(e.source) || new Set<string>();

    // Group fields by definedOnTable
    const fieldsByGroup = new Map<
      string,
      { element: string; definedOnTable: string }[]
    >();
    for (const field of e.fields) {
      const group = fieldsByGroup.get(field.definedOnTable) || [];
      group.push(field);
      fieldsByGroup.set(field.definedOnTable, group);
    }

    for (const [groupTable, fields] of fieldsByGroup) {
      if (nodeGroups.has(groupTable)) {
        // Group is expanded: one edge per field, pinned to field row
        for (const field of fields) {
          result.push({
            id: `${e.source}-${e.target}-ref-${field.element}`,
            source: e.source,
            target: e.target,
            type: "reference",
            data: { type: "reference" }, // no label when expanded
            animated: true,
            sourceHandle: `ref-field-${field.element}`,
            targetHandle,
          });
        }
      } else {
        // Group is collapsed: one edge per group, pinned to group header
        result.push({
          id: `${e.source}-${e.target}-ref-grp-${groupTable}`,
          source: e.source,
          target: e.target,
          type: "reference",
          data: { type: "reference" }, // no label when expanded
          animated: true,
          sourceHandle: `ref-group-${groupTable}`,
          targetHandle,
        });
      }
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// SchemaMapInner
// ---------------------------------------------------------------------------

function SchemaMapInner() {
  const { selectedSnapshotId, selectedTable, setSelectedTable } =
    useExplorerStore();
  const { fitView } = useReactFlow();

  const [nodes, setNodes] = useState<Node[]>([]);
  const [graphData, setGraphData] = useState<GraphResponse | null>(null);
  const [centerTable, setCenterTable] = useState<string | null>(null);
  const [depth, setDepth] = useState(2);
  const [showRefs, setShowRefs] = useState(true);
  const [direction, setDirection] = useState<"TB" | "LR">("TB");
  const [loading, setLoading] = useState(false);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [expandedGroups, setExpandedGroups] = useState<
    Map<string, Set<string>>
  >(new Map());
  const [columnsLoadedNodes, setColumnsLoadedNodes] = useState<Set<string>>(
    new Set()
  );

  const abortRef = useRef<AbortController | null>(null);

  // Sync centerTable with selectedTable from tree
  useEffect(() => {
    if (selectedTable && selectedTable !== centerTable) {
      setCenterTable(selectedTable);
      setExpandedNodes(new Set());
      setExpandedGroups(new Map());
      setColumnsLoadedNodes(new Set());
    }
  }, [selectedTable, centerTable]);

  // -----------------------------------------------------------------------
  // Handlers passed to nodes
  // -----------------------------------------------------------------------

  const handleToggleExpand = useCallback((nodeId: string) => {
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
    // (expandedGroups & columnsLoadedNodes are preserved so edges snap
    //  back to field-level handles immediately on re-expand)
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
  }, []);

  const handleToggleGroup = useCallback(
    (nodeId: string, groupName: string) => {
      setExpandedGroups((prev) => {
        const next = new Map(prev);
        const groups = new Set(next.get(nodeId) || []);
        if (groups.has(groupName)) {
          groups.delete(groupName);
        } else {
          groups.add(groupName);
        }
        next.set(nodeId, groups);

        // Also update node data so TableNode re-renders with correct state
        setNodes((prevNodes) =>
          prevNodes.map((n) => {
            if (n.id === nodeId) {
              return {
                ...n,
                data: { ...n.data, expandedGroupNames: new Set(groups) },
              };
            }
            return n;
          })
        );

        return next;
      });
    },
    []
  );

  const handleColumnsLoaded = useCallback(
    (nodeId: string, ownTableName: string) => {
      setColumnsLoadedNodes((prev) => new Set([...prev, nodeId]));

      // Auto-expand own columns group
      const groups = new Set([ownTableName]);
      setExpandedGroups((prev) => {
        const next = new Map(prev);
        next.set(nodeId, groups);
        return next;
      });

      // Update node data
      setNodes((prevNodes) =>
        prevNodes.map((n) => {
          if (n.id === nodeId) {
            return {
              ...n,
              data: { ...n.data, expandedGroupNames: new Set(groups) },
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
      setExpandedGroups(new Map());
      setColumnsLoadedNodes(new Set());
    },
    [setSelectedTable]
  );

  // -----------------------------------------------------------------------
  // Fetch graph data
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (!selectedSnapshotId || !centerTable) {
      setNodes([]);
      setGraphData(null);
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

        // Convert to React Flow nodes
        const rfNodes: Node[] = data.nodes.map((n) => ({
          id: n.name,
          type: n.isDetailed ? "tableNode" : "miniNode",
          position: { x: 0, y: 0 },
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
            isReferenceTarget: n.isReferenceTarget,
            expanded: expandedNodes.has(n.name),
            columnCount: n.ownColumnCount,
            snapshotId: selectedSnapshotId,
            onToggleExpand: handleToggleExpand,
            onDoubleClick: handleRecenter,
            onToggleGroup: handleToggleGroup,
            onColumnsLoaded: handleColumnsLoaded,
            expandedGroupNames:
              expandedGroups.get(n.name) || new Set<string>(),
          },
        }));

        // Build temporary edges for layout (only inheritance drives dagre)
        const inhSource = direction === "TB" ? "bottom" : "right";
        const inhTarget = direction === "TB" ? "top" : "left";
        const layoutEdges: Edge[] = data.edges
          .filter((e) => e.type === "inheritance")
          .map((e, i) => ({
            id: `${e.source}-${e.target}-inh-${i}`,
            source: e.source,
            target: e.target,
            type: "inheritance",
            data: { type: "inheritance" },
            sourceHandle: inhSource,
            targetHandle: inhTarget,
          }));

        // Run layout (only uses inheritance edges for positioning)
        const { nodes: layoutNodes } = computeLayout(
          rfNodes,
          layoutEdges,
          direction
        );

        setNodes(layoutNodes);
        setGraphData(data);

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

  // -----------------------------------------------------------------------
  // Compute edges reactively from graph data + expansion state
  // -----------------------------------------------------------------------
  const edges = useMemo(() => {
    if (!graphData) return [];

    const includedNames = new Set(graphData.nodes.map((n) => n.name));
    const refTargetSet = new Set(
      graphData.nodes.filter((n) => n.isReferenceTarget).map((n) => n.name)
    );

    return buildEdgesFromGraphData(
      graphData.edges,
      includedNames,
      refTargetSet,
      expandedNodes,
      expandedGroups,
      columnsLoadedNodes,
      direction
    );
  }, [
    graphData,
    expandedNodes,
    expandedGroups,
    columnsLoadedNodes,
    direction,
  ]);

  // -----------------------------------------------------------------------
  // Other handlers
  // -----------------------------------------------------------------------

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
      setExpandedGroups(new Map());
      setColumnsLoadedNodes(new Set());
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
