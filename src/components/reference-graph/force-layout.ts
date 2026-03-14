import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  forceX,
  forceY,
  type SimulationNodeDatum,
  type SimulationLinkDatum,
} from "d3-force";
import type { ReferenceGraphNode, ReferenceGraphEdge, GraphEdgeType } from "@/types";
import type { LayoutNode, LayoutEdge } from "./types";

export interface ForceNode extends SimulationNodeDatum {
  id: string;
  label: string;
  degree: number;
  radius: number;
  data: ReferenceGraphNode;
}

export interface ForceLink extends SimulationLinkDatum<ForceNode> {
  id: string;
  type: GraphEdgeType;
  weight: number;
  fields: ReferenceGraphEdge["fields"];
}

/** Compute node radius from degree (more connections → bigger, capped at 50px) */
export function nodeRadius(degree: number): number {
  return Math.min(50, Math.max(6, 4 + Math.sqrt(degree) * 5));
}

export interface ForceLayoutOptions {
  width: number;
  height: number;
  linkDistance: number;
  chargeStrength: number;
}

/**
 * Run d3-force simulation and return layout nodes and edges.
 */
export function computeForceLayout(
  graphNodes: ReferenceGraphNode[],
  graphEdges: ReferenceGraphEdge[],
  options: ForceLayoutOptions
): { nodes: LayoutNode[]; edges: LayoutEdge[] } {
  const { width, height, linkDistance, chargeStrength } = options;

  // Build lookup for valid node IDs
  const nodeIds = new Set(graphNodes.map((n) => n.name));

  // Tight initial spread — circular seeding for natural sphere shape
  const spread = Math.min(width, height) * 0.2;

  // Create simulation nodes with circular initial positions (not square)
  const simNodes: ForceNode[] = graphNodes.map((n) => {
    const angle = Math.random() * Math.PI * 2;
    const r = Math.random() * spread;
    return {
      id: n.name,
      label: n.label,
      degree: n.degree,
      radius: nodeRadius(n.degree),
      data: n,
      x: Math.cos(angle) * r,
      y: Math.sin(angle) * r,
    };
  });

  // Create simulation links (only for edges where both endpoints exist)
  const nodeMap = new Map(simNodes.map((n) => [n.id, n]));
  const simLinks: ForceLink[] = graphEdges
    .filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target))
    .map((e, i) => ({
      id: `${e.source}→${e.target}:${e.type}`,
      source: nodeMap.get(e.source)!,
      target: nodeMap.get(e.target)!,
      type: e.type,
      weight: e.weight,
      fields: e.fields,
    }));

  // Run the simulation
  const simulation = forceSimulation<ForceNode>(simNodes)
    .force(
      "link",
      forceLink<ForceNode, ForceLink>(simLinks)
        .id((d) => d.id)
        .distance(linkDistance)
    )
    .force("charge", forceManyBody<ForceNode>().strength(chargeStrength))
    .force("center", forceCenter(0, 0))
    .force(
      "collide",
      forceCollide<ForceNode>((d) => d.radius + 8)
    )
    // Strong containment forces — pull all nodes toward center for tight sphere shape
    // (Obsidian-style ball cluster). Strength 0.1 balances charge repulsion to keep
    // the graph compact without crushing nodes together.
    .force("x", forceX<ForceNode>(0).strength(0.1))
    .force("y", forceY<ForceNode>(0).strength(0.1))
    .stop();

  // Tick to convergence — 300 ticks ensures full settling with strong containment
  simulation.tick(300);

  // Convert to LayoutNode format
  const layoutNodes: LayoutNode[] = simNodes.map((n) => ({
    id: n.id,
    x: n.x ?? 0,
    y: n.y ?? 0,
    radius: n.radius,
    label: n.data.label,
    scopeName: n.data.scopeName,
    degree: n.degree,
    isOrphan: n.data.isOrphan,
    inboundReferenceCount: n.data.inboundReferenceCount,
    outboundReferenceCount: n.data.outboundReferenceCount,
    data: n.data,
  }));

  const layoutEdges: LayoutEdge[] = simLinks.map((l) => {
    const source = l.source as ForceNode;
    const target = l.target as ForceNode;
    return {
      id: l.id,
      source: source.id,
      target: target.id,
      type: l.type,
      weight: l.weight,
      fields: l.fields,
    };
  });

  return { nodes: layoutNodes, edges: layoutEdges };
}
