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

/** Shared empty set so nodes without expanded groups don't create new refs */
const EMPTY_GROUP_NAMES = new Set<string>();

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
  direction: "TB" | "LR",
  highlightedRefField: string | null,
  dotWalkExpandedTargets: Set<string>,
  displayColumnByTarget: Map<string, string | null>
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
    // If the target MiniNode is expanded and has a display column, pin to it
    const targetDisplayCol = displayColumnByTarget.get(e.target);
    const targetIsExpandedWithDisplay =
      dotWalkExpandedTargets.has(e.target) && !!targetDisplayCol;
    const targetHandle = targetIsExpandedWithDisplay
      ? "ref-target-display"
      : targetIsRefOnly
        ? "left"
        : "right-target";

    const isSourceExpanded =
      expandedNodes.has(e.source) && columnsLoadedNodes.has(e.source);

    if (!isSourceExpanded || !e.fields) {
      // Collapsed: single edge with label, generic right handle
      // Highlight if any of the bundled fields match the selected field
      const isHighlighted = highlightedRefField != null &&
        (e.fields?.some((f) => f.element === highlightedRefField) ?? false);
      result.push({
        id: `${e.source}-${e.target}-ref-${edgeIdx++}`,
        source: e.source,
        target: e.target,
        type: "reference",
        data: { type: "reference", label: e.label, highlighted: isHighlighted },
        animated: isHighlighted,
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
          const isHighlighted = highlightedRefField === field.element;
          result.push({
            id: `${e.source}-${e.target}-ref-${field.element}`,
            source: e.source,
            target: e.target,
            type: "reference",
            data: { type: "reference", highlighted: isHighlighted },
            animated: isHighlighted,
            sourceHandle: `ref-field-${field.element}`,
            targetHandle,
          });
        }
      } else {
        // Group is collapsed: one edge per group, pinned to group header
        const isHighlighted = highlightedRefField != null &&
          fields.some((f) => f.element === highlightedRefField);
        result.push({
          id: `${e.source}-${e.target}-ref-grp-${groupTable}`,
          source: e.source,
          target: e.target,
          type: "reference",
          data: { type: "reference", highlighted: isHighlighted },
          animated: isHighlighted,
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
  const { selectedSnapshotId, selectedTable, setSelectedTable, queryBuilderFields, toggleField } =
    useExplorerStore();
  const { fitView } = useReactFlow();

  // Compute a Set of selected field element names for fast lookup in nodes
  const querySelectedFieldSet = useMemo(
    () => new Set(queryBuilderFields.map((f) => f.element)),
    [queryBuilderFields]
  );

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
  const [highlightedRefField, setHighlightedRefField] = useState<string | null>(
    null
  );

  // Dot-walk expansion state
  const [dotWalkExpandedNodes, setDotWalkExpandedNodes] = useState<Set<string>>(
    new Set()
  );
  const [dotWalkColumns, setDotWalkColumns] = useState<
    Map<string, { element: string; label: string; internalType: string }[]>
  >(new Map());
  const [dotWalkLoadingNodes, setDotWalkLoadingNodes] = useState<Set<string>>(
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
      setHighlightedRefField(null);
      setDotWalkExpandedNodes(new Set());
      setDotWalkColumns(new Map());
      setDotWalkLoadingNodes(new Set());
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
        return next;
      });
    },
    []
  );

  const handleColumnsLoaded = useCallback(
    (nodeId: string, ownTableName: string) => {
      setColumnsLoadedNodes((prev) => new Set([...prev, nodeId]));

      // Auto-expand own columns group
      setExpandedGroups((prev) => {
        const next = new Map(prev);
        const groups = new Set(next.get(nodeId) || []);
        groups.add(ownTableName);
        next.set(nodeId, groups);
        return next;
      });
    },
    []
  );

  const handleToggleQueryField = useCallback(
    (col: { element: string; label: string; definedOnTable: string; internalType: string; referenceTable: string | null }) => {
      toggleField({
        element: col.element,
        label: col.label,
        definedOnTable: col.definedOnTable,
        internalType: col.internalType,
        referenceTable: col.referenceTable,
      });
    },
    [toggleField]
  );

  const handleToggleDotWalkExpand = useCallback(
    (tableName: string) => {
      setDotWalkExpandedNodes((prev) => {
        const next = new Set(prev);
        if (next.has(tableName)) {
          next.delete(tableName);
        } else {
          next.add(tableName);
          // Fetch columns if we haven't already
          if (!dotWalkColumns.has(tableName) && selectedSnapshotId) {
            setDotWalkLoadingNodes((p) => new Set([...p, tableName]));
            fetch(
              `/api/tables/${encodeURIComponent(tableName)}?snapshotId=${selectedSnapshotId}`
            )
              .then((r) => r.json())
              .then((detail) => {
                const cols = (detail.columns || []).map(
                  (c: { element: string; label: string; internalType: string }) => ({
                    element: c.element,
                    label: c.label,
                    internalType: c.internalType,
                  })
                );
                setDotWalkColumns((prev) => new Map(prev).set(tableName, cols));
              })
              .catch(console.error)
              .finally(() => {
                setDotWalkLoadingNodes((p) => {
                  const next = new Set(p);
                  next.delete(tableName);
                  return next;
                });
              });
          }
        }
        return next;
      });
    },
    [dotWalkColumns, selectedSnapshotId]
  );

  const handleFieldClick = useCallback(
    (_nodeId: string, fieldElement: string) => {
      // Toggle: click same field again to deselect
      const newValue = highlightedRefField === fieldElement ? null : fieldElement;
      setHighlightedRefField(newValue);

      // Auto-expand the target MiniNode when highlighting a reference field
      if (newValue && graphData) {
        for (const e of graphData.edges) {
          if (e.type === "reference" && e.fields) {
            for (const f of e.fields) {
              if (f.element === newValue && !dotWalkExpandedNodes.has(e.target)) {
                // Trigger expansion of the target node
                handleToggleDotWalkExpand(e.target);
              }
            }
          }
        }
      }
    },
    [highlightedRefField, graphData, dotWalkExpandedNodes, handleToggleDotWalkExpand]
  );

  const { toggleDotWalkField } = useExplorerStore();

  const handleToggleDotWalkField = useCallback(
    (parentElement: string, child: { element: string; label: string }) => {
      toggleDotWalkField(parentElement, child);
    },
    [toggleDotWalkField]
  );

  const handleRecenter = useCallback(
    (tableName: string) => {
      setCenterTable(tableName);
      setSelectedTable(tableName);
      setExpandedNodes(new Set());
      setExpandedGroups(new Map());
      setColumnsLoadedNodes(new Set());
      setHighlightedRefField(null);
      setDotWalkExpandedNodes(new Set());
      setDotWalkColumns(new Map());
      setDotWalkLoadingNodes(new Set());
    },
    [setSelectedTable]
  );

  // -----------------------------------------------------------------------
  // Fetch graph data
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (!selectedSnapshotId || !centerTable) {
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
        setGraphData(data);
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
  // Compute nodes with layout — reactive to graph data + expansion state.
  // When a node expands/collapses, dagre re-runs with updated height
  // estimates so surrounding nodes shift to avoid overlap.
  // -----------------------------------------------------------------------
  const nodes = useMemo(() => {
    if (!graphData || !selectedSnapshotId) return [];

    // Filter nodes based on view mode:
    // showRefs = true  → center table + reference targets only
    // showRefs = false → hierarchy only (exclude ref-only targets)
    // Note: some reference edges may point to tables that are also in the
    // hierarchy (e.g. a parent table). Those nodes have isReferenceTarget=false
    // but still need to appear in reference view.
    let visibleGraphNodes;
    if (showRefs) {
      const refEdgeTargets = new Set(
        graphData.edges
          .filter((e) => e.type === "reference")
          .map((e) => e.target)
      );
      visibleGraphNodes = graphData.nodes.filter(
        (n) => n.isCenter || n.isReferenceTarget || refEdgeTargets.has(n.name)
      );
    } else {
      visibleGraphNodes = graphData.nodes.filter(
        (n) => !n.isReferenceTarget
      );
    }

    // Build a map: target table name → highlighted reference field element
    // This tells each MiniNode which parent reference field currently points to it
    const refTargetToParentField = new Map<string, string>();
    if (highlightedRefField) {
      for (const e of graphData.edges) {
        if (e.type === "reference" && e.fields) {
          for (const f of e.fields) {
            if (f.element === highlightedRefField) {
              refTargetToParentField.set(e.target, highlightedRefField);
            }
          }
        }
      }
    }

    // Build dot-walk selected fields per MiniNode (from store's queryBuilderFields)
    const dotWalkSelectedByTable = new Map<string, Set<string>>();
    for (const qf of queryBuilderFields) {
      if (qf.referenceTable && qf.dotWalkFields.length > 0) {
        const existing = dotWalkSelectedByTable.get(qf.referenceTable) || new Set<string>();
        for (const dw of qf.dotWalkFields) {
          existing.add(dw.element);
        }
        dotWalkSelectedByTable.set(qf.referenceTable, existing);
      }
    }

    const rfNodes: Node[] = visibleGraphNodes.map((n) => {
      const isMiniNode = !(n.isDetailed && !(showRefs && !n.isCenter));
      const parentRefElement = refTargetToParentField.get(n.name) || null;

      return {
        id: n.name,
        type: isMiniNode ? "miniNode" : "tableNode",
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
          isReferenceTarget: n.isReferenceTarget || (showRefs && !n.isCenter),
          ancestorOwnCounts: n.ancestorOwnCounts,
          expanded: expandedNodes.has(n.name),
          columnCount: n.ownColumnCount,
          snapshotId: selectedSnapshotId,
          onToggleExpand: handleToggleExpand,
          onDoubleClick: handleRecenter,
          onToggleGroup: handleToggleGroup,
          onColumnsLoaded: handleColumnsLoaded,
          onFieldClick: handleFieldClick,
          onToggleQueryField: handleToggleQueryField,
          highlightedRefField,
          expandedGroupNames:
            expandedGroups.get(n.name) || EMPTY_GROUP_NAMES,
          querySelectedFields: querySelectedFieldSet,
          // Dot-walk props for MiniNodes
          dotWalkExpanded: dotWalkExpandedNodes.has(n.name),
          dotWalkColumns: dotWalkColumns.get(n.name) || [],
          dotWalkSelectedFields: dotWalkSelectedByTable.get(n.name) || EMPTY_GROUP_NAMES,
          dotWalkLoading: dotWalkLoadingNodes.has(n.name),
          parentRefElement,
          displayColumn: n.displayColumn || null,
          onToggleDotWalkExpand: handleToggleDotWalkExpand,
          onToggleDotWalkField: handleToggleDotWalkField,
        },
      };
    });

    // Build layout edges (only inheritance for dagre positioning)
    const inhSource = direction === "TB" ? "bottom" : "right";
    const inhTarget = direction === "TB" ? "top" : "left";
    const layoutEdges: Edge[] = graphData.edges
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

    // Run dagre layout (node heights adapt to expansion state)
    const { nodes: layoutNodes } = computeLayout(
      rfNodes,
      layoutEdges,
      direction
    );

    return layoutNodes;
  }, [
    graphData,
    selectedSnapshotId,
    showRefs,
    expandedNodes,
    expandedGroups,
    direction,
    handleToggleExpand,
    handleRecenter,
    handleToggleGroup,
    handleColumnsLoaded,
    handleFieldClick,
    handleToggleQueryField,
    highlightedRefField,
    querySelectedFieldSet,
    queryBuilderFields,
    dotWalkExpandedNodes,
    dotWalkColumns,
    dotWalkLoadingNodes,
    handleToggleDotWalkExpand,
    handleToggleDotWalkField,
  ]);

  // Fit view when new graph data loads or view mode changes
  useEffect(() => {
    if (graphData && nodes.length > 0) {
      requestAnimationFrame(() => {
        fitView({ padding: 0.15, duration: 300 });
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graphData, showRefs, fitView]);

  // -----------------------------------------------------------------------
  // Compute edges reactively from graph data + expansion state
  // -----------------------------------------------------------------------
  const edges = useMemo(() => {
    if (!graphData) return [];

    // Filter edges by view mode: refs view → reference edges, hierarchy view → inheritance edges
    const visibleEdges = showRefs
      ? graphData.edges.filter((e) => e.type === "reference")
      : graphData.edges.filter((e) => e.type === "inheritance");

    const includedNames = new Set(graphData.nodes.map((n) => n.name));
    // In ref view, all non-center nodes are positioned in the reference column
    // so they all need "left" target handles
    const refTargetSet = showRefs
      ? new Set(graphData.nodes.filter((n) => !n.isCenter).map((n) => n.name))
      : new Set(
          graphData.nodes.filter((n) => n.isReferenceTarget).map((n) => n.name)
        );

    // Build display column lookup for reference targets
    const displayColumnByTarget = new Map<string, string | null>();
    for (const n of graphData.nodes) {
      if (n.displayColumn) {
        displayColumnByTarget.set(n.name, n.displayColumn);
      }
    }

    return buildEdgesFromGraphData(
      visibleEdges,
      includedNames,
      refTargetSet,
      expandedNodes,
      expandedGroups,
      columnsLoadedNodes,
      direction,
      highlightedRefField,
      dotWalkExpandedNodes,
      displayColumnByTarget
    );
  }, [
    graphData,
    showRefs,
    expandedNodes,
    expandedGroups,
    columnsLoadedNodes,
    direction,
    highlightedRefField,
    dotWalkExpandedNodes,
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
      setHighlightedRefField(null);
      setDotWalkExpandedNodes(new Set());
      setDotWalkColumns(new Map());
      setDotWalkLoadingNodes(new Set());
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
