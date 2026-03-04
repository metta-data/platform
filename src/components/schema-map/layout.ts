import dagre from "@dagrejs/dagre";
import type { Node, Edge } from "@xyflow/react";

const DETAILED_NODE_WIDTH = 240;
const DETAILED_NODE_HEIGHT = 80;
const MINI_NODE_WIDTH = 140;
const MINI_NODE_HEIGHT = 36;

const REF_COL_GAP = 12; // vertical gap between reference target nodes
const REF_OFFSET = 220; // horizontal gap between hierarchy and reference column (room for labels)

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

  // Apply dagre positions to hierarchy nodes, track bounding box & center table position
  let maxX = -Infinity;
  let centerY = 0; // Y position of the center/focused table
  let centerX = 0;

  const positionedHierarchy = hierarchyNodes.map((node) => {
    const nodeWithPosition = g.node(node.id);
    if (!nodeWithPosition) return node;

    const { width, height } = getNodeDimensions(node);
    const x = nodeWithPosition.x - width / 2;
    const y = nodeWithPosition.y - height / 2;

    maxX = Math.max(maxX, x + width);

    // Track the center table's position for reference column alignment
    if (node.data?.isCenter) {
      centerY = nodeWithPosition.y; // dagre center Y
      centerX = nodeWithPosition.x;
    }

    return { ...node, position: { x, y } };
  });

  // --- Position reference target nodes in a column to the right ---
  // Center them vertically around the focused table's Y position
  const totalRefHeight = refTargetNodes.reduce((sum, n) => {
    return sum + getNodeDimensions(n).height + REF_COL_GAP;
  }, -REF_COL_GAP); // subtract last gap

  if (direction === "TB") {
    const refX = maxX + REF_OFFSET;
    const refStartY = centerY - totalRefHeight / 2;

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
    const refY = maxX + REF_OFFSET; // reuse maxX as it's the max in the flow direction
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
