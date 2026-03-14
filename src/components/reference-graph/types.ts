import type { ReferenceGraphNode, ReferenceGraphEdge, GraphEdgeType } from "@/types";

/** Layout node — output from force simulation, consumed by canvas renderer */
export interface LayoutNode {
  id: string;
  x: number;
  y: number;
  radius: number;
  label: string;
  scopeName: string | null;
  degree: number;
  isOrphan: boolean;
  inboundReferenceCount: number;
  outboundReferenceCount: number;
  /** Full API data for info panel */
  data: ReferenceGraphNode;
}

/** Layout edge — output from force simulation, consumed by canvas renderer */
export interface LayoutEdge {
  id: string;
  source: string;
  target: string;
  /** Edge type: "reference" (field FK) or "hierarchy" (extends) */
  type: GraphEdgeType;
  weight: number;
  fields: ReferenceGraphEdge["fields"];
}
