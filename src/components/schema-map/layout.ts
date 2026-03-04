import dagre from "@dagrejs/dagre";
import type { Node, Edge } from "@xyflow/react";

const DETAILED_NODE_WIDTH = 240;
const DETAILED_NODE_HEIGHT = 80;
const MINI_NODE_WIDTH = 140;
const MINI_NODE_HEIGHT = 36;

const REF_COL_GAP = 16; // vertical gap between reference target nodes
const REF_OFFSET = 120; // horizontal gap between hierarchy and reference column

function getNodeDimensions(node: Node) {
  const isMini = node.type === "miniNode";
  const width = isMini ? MINI_NODE_WIDTH : DETAILED_NODE_WIDTH;
  let height = isMini ? MINI_NODE_HEIGHT : DETAILED_NODE_HEIGHT;

  if (!isMini && node.data?.expanded) {
    height += Math.min((node.data.columnCount as number) || 0, 8) * 24 + 16;
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

  // --- Layout hierarchy nodes with dagre ---
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: direction,
    nodesep: 40,
    ranksep: 60,
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

  // Apply dagre positions to hierarchy nodes and track bounding box
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;

  const positionedHierarchy = hierarchyNodes.map((node) => {
    const nodeWithPosition = g.node(node.id);
    if (!nodeWithPosition) return node;

    const { width, height } = getNodeDimensions(node);
    const x = nodeWithPosition.x - width / 2;
    const y = nodeWithPosition.y - height / 2;

    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x + width);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y + height);

    return { ...node, position: { x, y } };
  });

  // --- Position reference target nodes in a column to the right ---
  const hierarchyCenterY = (minY + maxY) / 2;
  const totalRefHeight = refTargetNodes.reduce((sum, n) => {
    return sum + getNodeDimensions(n).height + REF_COL_GAP;
  }, -REF_COL_GAP); // subtract last gap

  // TB: reference targets go to the right of the hierarchy
  // LR: reference targets go below the hierarchy
  let refX: number, refStartY: number;

  if (direction === "TB") {
    refX = maxX + REF_OFFSET;
    refStartY = hierarchyCenterY - totalRefHeight / 2;
  } else {
    // LR layout: place refs below
    const hierarchyCenterX = (minX + maxX) / 2;
    refX = hierarchyCenterX - totalRefHeight / 2; // reuse as horizontal spread
    refStartY = maxY + REF_OFFSET;
  }

  let currentOffset = 0;
  const positionedRefs = refTargetNodes.map((node) => {
    const { width, height } = getNodeDimensions(node);
    let pos: { x: number; y: number };

    if (direction === "TB") {
      pos = { x: refX, y: refStartY + currentOffset };
    } else {
      pos = { x: refStartY + currentOffset, y: refX }; // swap axes for LR
    }

    currentOffset += height + REF_COL_GAP;

    return { ...node, position: pos };
  });

  return {
    nodes: [...positionedHierarchy, ...positionedRefs],
    edges,
  };
}
