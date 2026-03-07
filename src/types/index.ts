export type { GraphNode, GraphEdge, GraphResponse } from "./graph";

export interface TreeTableNode {
  name: string;
  label: string;
  superClassName: string | null;
  scopeName: string | null;
  scopeLabel: string | null;
  ownColumnCount: number;
  totalColumnCount: number;
  childTableCount: number;
}

export interface TreeNode {
  id: string;
  name: string;
  data: TreeTableNode;
  children: TreeNode[];
}

export interface SnapshotSummary {
  id: string;
  label: string;
  version: string | null;
  description: string | null;
  status: string;
  tableCount: number;
  columnCount: number;
  isBaseline: boolean;
  createdAt: string;
}

export interface TableDetail {
  name: string;
  label: string;
  superClassName: string | null;
  scopeName: string | null;
  scopeLabel: string | null;
  isExtendable: boolean;
  numberPrefix: string | null;
  ownColumnCount: number;
  totalColumnCount: number;
  childTableCount: number;
  columns: ColumnDetail[];
  inheritanceChain: { name: string; label: string }[];
  childTables: string[];
}

export interface ColumnDetail {
  element: string;
  label: string;
  definedOnTable: string;
  internalType: string;
  referenceTable: string | null;
  maxLength: number | null;
  isMandatory: boolean;
  isReadOnly: boolean;
  isActive: boolean;
  isDisplay: boolean;
  isPrimary: boolean;
  defaultValue: string | null;
}

/** A field selected in the Schema Map query builder */
export interface SelectedField {
  /** Field element name on the base table, e.g. "caller_id" */
  element: string;
  /** Human-readable label */
  label: string;
  /** The table this field is defined on (for inheritance awareness) */
  definedOnTable: string;
  /** If this is a reference field, the table it points to */
  referenceTable: string | null;
  /** Dot-walked sub-fields selected on the referenced table */
  dotWalkFields: { element: string; label: string }[];
}

export interface ComparisonResult {
  addedTables: TableDiff[];
  removedTables: TableDiff[];
  modifiedTables: TableModification[];
  unchangedTableCount: number;
  summary: {
    addedTableCount: number;
    removedTableCount: number;
    modifiedTableCount: number;
    addedColumnCount: number;
    removedColumnCount: number;
    modifiedColumnCount: number;
  };
}

export interface TableDiff {
  name: string;
  label: string;
  columnCount: number;
}

export interface TableModification {
  tableName: string;
  tableLabel: string;
  addedColumns: ColumnDiff[];
  removedColumns: ColumnDiff[];
  modifiedColumns: ColumnModification[];
}

export interface ColumnDiff {
  element: string;
  label: string;
  internalType: string;
}

export interface ColumnModification {
  element: string;
  label: string;
  changes: {
    field: string;
    oldValue: string | null;
    newValue: string | null;
  }[];
}
