export type GraphViewMode = "tables" | "fields";

export interface ReferenceGraphNode {
  /** Technical table name (e.g. "incident") */
  name: string;
  /** Human-readable label (e.g. "Incident") */
  label: string;
  scopeName: string | null;
  scopeLabel: string | null;
  totalColumnCount: number;
  /** Number of other tables that reference this one */
  inboundReferenceCount: number;
  /** Number of other tables this one references */
  outboundReferenceCount: number;
  /** Total connections (inbound + outbound) — drives node sizing */
  degree: number;
  /** True if this table has zero reference connections */
  isOrphan: boolean;
  /** Parent table name (superClass) for table hierarchy */
  superClassName: string | null;
}

/** Edge type: "reference" = field foreign key, "hierarchy" = table extends */
export type GraphEdgeType = "reference" | "hierarchy";

export interface ReferenceGraphEdge {
  /** Source table name (the table with the reference column) */
  source: string;
  /** Target table name (the referenced table) */
  target: string;
  /** Edge type: reference (field FK) or hierarchy (extends) */
  type: GraphEdgeType;
  /** Fields creating this reference (empty for hierarchy edges) */
  fields: { element: string; label: string; definedOnTable: string }[];
  /** Number of fields creating this link (for edge thickness) */
  weight: number;
}

export interface ReferenceGraphResponse {
  nodes: ReferenceGraphNode[];
  edges: ReferenceGraphEdge[];
  stats: {
    totalTables: number;
    totalReferences: number;
    orphanCount: number;
  };
}
