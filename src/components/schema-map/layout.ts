import dagre from "@dagrejs/dagre";
import type { Node, Edge } from "@xyflow/react";
import {
  HEADER_HEIGHT,
  BORDER_T,
  GROUP_HEADER_H,
  GROUP_PAD,
  FIELD_ROW_H,
  FILTER_INPUT_H,
  MAX_VISIBLE_ROWS,
} from "./constants";

const DETAILED_NODE_WIDTH = 240;
const DETAILED_NODE_HEIGHT = 80;
const MINI_NODE_WIDTH = 160;
const MINI_NODE_EXPANDED_WIDTH = 220;
const MINI_NODE_HEIGHT = 36;
const MAX_DOT_WALK_ROWS = 20;

const REF_COL_GAP = 12; // vertical gap between reference target nodes
const REF_OFFSET = 320; // horizontal gap between hierarchy and reference column

function getNodeDimensions(node: Node) {
  const isMini = node.type === "miniNode";
  const isDotWalkExpanded = isMini && node.data?.dotWalkExpanded;
  const width = isMini
    ? isDotWalkExpanded
      ? MINI_NODE_EXPANDED_WIDTH
      : MINI_NODE_WIDTH
    : DETAILED_NODE_WIDTH;
  let height = isMini ? MINI_NODE_HEIGHT : DETAILED_NODE_HEIGHT;

  // Expanded MiniNode: add height for dot-walk column list
  if (isDotWalkExpanded) {
    const cols = node.data?.dotWalkColumns as { element: string }[] | undefined;
    const dotWalkFilter = (node.data?.columnFilter as string) || "";
    const showAllDotWalk = !!(node.data?.showAllDotWalk);

    let colCount: number;
    if (dotWalkFilter || showAllDotWalk) {
      // When filtering or showing all, use full column count (overestimate for filter)
      colCount = cols ? cols.length : 0;
    } else {
      colCount = cols ? Math.min(cols.length, MAX_DOT_WALK_ROWS) : 0;
    }

    if (colCount > 0) {
      // border-t + filter input + padding + rows
      height += 1 + FILTER_INPUT_H + GROUP_PAD * 2 + colCount * FIELD_ROW_H;
      if (cols && cols.length > MAX_DOT_WALK_ROWS && !dotWalkFilter) {
        height += FIELD_ROW_H; // "+N more..." row
      }
    } else {
      height += 24; // Loading/empty state
    }
  }

  if (!isMini && node.data?.expanded) {
    if (node.data.isCenter) {
      // Center node has no scroll container — compute precise height using
      // per-ancestor column counts and expanded group state.
      height = HEADER_HEIGHT + BORDER_T;

      const ancestorOwnCounts = node.data.ancestorOwnCounts as
        | { name: string; ownColumnCount: number }[]
        | undefined;
      const expandedGroupNames =
        (node.data.expandedGroupNames as Set<string> | undefined) ||
        new Set<string>();
      const showAllGroupNames =
        (node.data.showAllGroupNames as Set<string> | undefined) ||
        new Set<string>();
      const columnFilter = (node.data.columnFilter as string) || "";

      if (ancestorOwnCounts && ancestorOwnCounts.length > 0) {
        // Add filter input height
        height += FILTER_INPUT_H;

        // Precise calculation: we know each group's column count
        for (const group of ancestorOwnCounts) {
          height += GROUP_HEADER_H;
          if (expandedGroupNames.has(group.name)) {
            let visibleRows: number;
            if (columnFilter || showAllGroupNames.has(group.name)) {
              // When filtering or showing all, use full count (overestimate for filter is OK)
              visibleRows = group.ownColumnCount;
            } else {
              visibleRows = Math.min(
                group.ownColumnCount,
                MAX_VISIBLE_ROWS
              );
            }
            height += GROUP_PAD * 2 + visibleRows * FIELD_ROW_H;
            if (group.ownColumnCount > MAX_VISIBLE_ROWS && !columnFilter) {
              height += FIELD_ROW_H; // "+N more..." / "Show fewer" row
            }
          }
        }
      } else {
        // Fallback: no ancestor data yet, rough estimate
        height += FILTER_INPUT_H;
        const ownCols = (node.data.columnCount as number) || 0;
        const totalCols = (node.data.totalColumnCount as number) || 0;
        const numGroups =
          totalCols > ownCols
            ? Math.max(1, Math.ceil((totalCols - ownCols) / 25)) + 1
            : 1;
        height += numGroups * GROUP_HEADER_H;
        // Assume own group is auto-expanded
        height +=
          GROUP_PAD * 2 +
          Math.min(ownCols, MAX_VISIBLE_ROWS) * FIELD_ROW_H;
      }
    } else {
      // Non-center nodes have a 400px max-height scroll container.
      const totalCols = (node.data.totalColumnCount as number) || 0;
      height += Math.min(totalCols * FIELD_ROW_H + FILTER_INPUT_H + 16, 400);
    }
  }

  return { width, height };
}

export function computeLayout(
  nodes: Node[],
  edges: Edge[],
  direction: "TB" | "LR" = "TB"
): { nodes: Node[]; edges: Edge[] } {
  // Split nodes into hierarchy nodes and reference-only targets
  const hierarchyNodes: Node[] = [];
  const refTargetNodes: Node[] = [];

  for (const node of nodes) {
    if (node.data?.isReferenceTarget) {
      refTargetNodes.push(node);
    } else {
      hierarchyNodes.push(node);
    }
  }

  // Increase rank spacing when center is expanded (tall) so children aren't cramped
  const centerNode = hierarchyNodes.find((n) => n.data?.isCenter);
  const centerIsExpanded = centerNode?.data?.expanded === true;

  // --- Layout hierarchy nodes with dagre ---
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: direction,
    nodesep: 40,
    ranksep: centerIsExpanded ? 100 : 60,
    edgesep: 15,
    marginx: 40,
    marginy: 40,
  });

  for (const node of hierarchyNodes) {
    const { width, height } = getNodeDimensions(node);
    g.setNode(node.id, { width, height });
  }

  // Only inheritance edges drive the hierarchy layout
  for (const edge of edges) {
    if (edge.data?.type === "inheritance") {
      g.setEdge(edge.source, edge.target);
    }
  }

  dagre.layout(g);

  // Build child→parent map from inheritance edges so we can walk the ancestor chain
  const childToParent = new Map<string, string>();
  for (const edge of edges) {
    if (edge.data?.type === "inheritance") {
      childToParent.set(edge.target, edge.source);
    }
  }

  // Find center node's dagre X center
  const centerNodeId = centerNode?.id;
  const centerDagre = centerNodeId ? g.node(centerNodeId) : null;
  const centerXMid = centerDagre?.x ?? 0;

  // Collect ancestor IDs (walk up from center)
  const ancestorIds = new Set<string>();
  if (centerNodeId) {
    let cur = childToParent.get(centerNodeId);
    while (cur) {
      ancestorIds.add(cur);
      cur = childToParent.get(cur);
    }
  }

  // Apply dagre positions to hierarchy nodes, track bounding box & center table position
  let maxX = -Infinity;
  let centerY = 0;
  let centerX = 0;
  let centerNodeHeight = DETAILED_NODE_HEIGHT;

  const positionedHierarchy = hierarchyNodes.map((node) => {
    const nodeWithPosition = g.node(node.id);
    if (!nodeWithPosition) return node;

    const { width, height } = getNodeDimensions(node);
    // Align ancestors to the center node's X midpoint
    const xMid = ancestorIds.has(node.id) ? centerXMid : nodeWithPosition.x;
    const x = xMid - width / 2;
    const y = nodeWithPosition.y - height / 2;

    maxX = Math.max(maxX, x + width);

    if (node.data?.isCenter) {
      centerY = nodeWithPosition.y;
      centerX = nodeWithPosition.x;
      centerNodeHeight = height;
    }

    return { ...node, position: { x, y } };
  });

  // --- Position reference target nodes in a column to the right ---
  // Align top of ref column with top of center node (not centered on midpoint)
  const totalRefHeight = refTargetNodes.reduce((sum, n) => {
    return sum + getNodeDimensions(n).height + REF_COL_GAP;
  }, -REF_COL_GAP); // subtract last gap

  if (direction === "TB") {
    const refX = maxX + REF_OFFSET;
    const centerTopY = centerY - centerNodeHeight / 2;
    const refStartY = centerTopY;

    let currentOffset = 0;
    for (const node of refTargetNodes) {
      const { height } = getNodeDimensions(node);
      (node as Node & { position: { x: number; y: number } }).position = {
        x: refX,
        y: refStartY + currentOffset,
      };
      currentOffset += height + REF_COL_GAP;
    }
  } else {
    // LR layout: reference targets go below, centered on center table's X
    const refY = maxX + REF_OFFSET;
    const refStartX = centerX - totalRefHeight / 2;

    let currentOffset = 0;
    for (const node of refTargetNodes) {
      const { height } = getNodeDimensions(node);
      (node as Node & { position: { x: number; y: number } }).position = {
        x: refStartX + currentOffset,
        y: refY,
      };
      currentOffset += height + REF_COL_GAP;
    }
  }

  return {
    nodes: [...positionedHierarchy, ...refTargetNodes],
    edges,
  };
}
