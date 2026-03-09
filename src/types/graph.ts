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
  /** Per-ancestor own-column counts for accurate layout height. Center table only. */
  ancestorOwnCounts?: { name: string; ownColumnCount: number }[];
  /** The display column element name for this table (resolved via ServiceNow's display value chain) */
  displayColumn?: string;
}

export interface GraphEdge {
  source: string;
  target: string;
  type: "inheritance" | "reference";
  label?: string;
  /** Per-field info for reference edges (for dynamic handle pinning) */
  fields?: { element: string; definedOnTable: string }[];
}

export interface GraphResponse {
  nodes: GraphNode[];
  edges: GraphEdge[];
  truncated: boolean;
}
