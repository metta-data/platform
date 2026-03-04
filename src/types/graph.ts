export interface GraphNode {
  name: string;
  label: string;
  scopeName: string | null;
  scopeLabel: string | null;
  ownColumnCount: number;
  totalColumnCount: number;
  childTableCount: number;
  isExtendable: boolean;
  isCenter: boolean;
  isTruncated: boolean;
  /** True for the center table and tables within `depth` distance */
  isDetailed: boolean;
  /** True if this node exists only because it's a reference target (not in the hierarchy) */
  isReferenceTarget: boolean;
}

export interface GraphEdge {
  source: string;
  target: string;
  type: "inheritance" | "reference";
  label?: string;
}

export interface GraphResponse {
  nodes: GraphNode[];
  edges: GraphEdge[];
  truncated: boolean;
}
