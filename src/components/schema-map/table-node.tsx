"use client";

import { memo, useState, useEffect, useMemo, useCallback } from "react";
import { Handle, Position, useUpdateNodeInternals } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";
import {
  ChevronDown,
  ChevronRight,
  Columns3,
  ArrowUpRight,
  Minus,
  Plus,
  Check,
  Search,
} from "lucide-react";
import {
  HEADER_HEIGHT,
  BORDER_T,
  GROUP_HEADER_H,
  GROUP_PAD,
  FIELD_ROW_H,
  FILTER_INPUT_H,
  MAX_VISIBLE_ROWS,
} from "./constants";

// Deterministic color from scope name
function scopeColor(scope: string | null): string {
  if (!scope) return "hsl(0, 0%, 75%)";
  let hash = 0;
  for (let i = 0; i < scope.length; i++) {
    hash = scope.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash % 360);
  return `hsl(${hue}, 55%, 55%)`;
}

function matchesFilter(
  col: { element: string; label: string },
  query: string
): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  return (
    col.element.toLowerCase().includes(q) ||
    col.label.toLowerCase().includes(q)
  );
}

interface ColumnInfo {
  element: string;
  label: string;
  internalType: string;
  referenceTable: string | null;
  definedOnTable: string;
}

interface ColumnGroup {
  tableName: string;
  tableLabel: string;
  columns: ColumnInfo[];
  isOwn: boolean;
  /** Whether this group contains any reference columns */
  hasRefs: boolean;
}

interface TableNodeData {
  label: string;
  name: string;
  scopeName: string | null;
  scopeLabel: string | null;
  ownColumnCount: number;
  totalColumnCount: number;
  childTableCount: number;
  isCenter: boolean;
  isTruncated: boolean;
  expanded: boolean;
  columnCount: number;
  snapshotId: string;
  onToggleExpand: (nodeId: string) => void;
  onDoubleClick: (tableName: string) => void;
  onToggleGroup: (nodeId: string, groupName: string) => void;
  onColumnsLoaded: (nodeId: string, ownTableName: string) => void;
  onFieldClick: (nodeId: string, fieldElement: string) => void;
  onToggleQueryField: (col: ColumnInfo) => void;
  highlightedRefField: string | null;
  expandedGroupNames: Set<string>;
  querySelectedFields: Set<string>;
  columnFilter: string;
  onSetColumnFilter: (nodeId: string, filter: string) => void;
  showAllGroupNames: Set<string>;
  onToggleShowAll: (nodeId: string, groupName: string) => void;
  [key: string]: unknown;
}

/** Get the visible columns for a group, accounting for filter and show-all state */
function getVisibleColumns(
  group: ColumnGroup,
  filter: string,
  showAll: boolean
): ColumnInfo[] {
  let cols = group.columns;
  if (filter) {
    cols = cols.filter((c) => matchesFilter(c, filter));
  }
  // When filtering or showing all, return everything; otherwise cap
  if (!filter && !showAll) {
    return cols.slice(0, MAX_VISIBLE_ROWS);
  }
  return cols;
}

function TableNodeComponent({ id, data }: NodeProps) {
  const d = data as unknown as TableNodeData;
  const [columnGroups, setColumnGroups] = useState<ColumnGroup[]>([]);
  const [loadingColumns, setLoadingColumns] = useState(false);
  const updateNodeInternals = useUpdateNodeInternals();

  // Use lifted expandedGroupNames from parent (SchemaMap) instead of local state
  const expandedGroupNames = d.expandedGroupNames || new Set<string>();
  const showAllGroupNames = d.showAllGroupNames || new Set<string>();
  const columnFilter = d.columnFilter || "";

  // --- Pre-computed handle positions ---
  // Compute handle positions arithmetically from the column group structure
  // using shared CSS pixel constants. This avoids the two-render-cycle timing
  // issues of DOM measurement (useLayoutEffect + getBoundingClientRect).
  const handlePositions = useMemo(() => {
    if (!d.expanded || columnGroups.length === 0) return [];

    const positions: { id: string; top: number }[] = [];
    let offset = HEADER_HEIGHT + BORDER_T;

    // Account for filter input row
    offset += FILTER_INPUT_H;

    for (const group of columnGroups) {
      // Group-level handle: only if group has reference columns
      if (group.hasRefs) {
        positions.push({
          id: `ref-group-${group.tableName}`,
          top: offset + GROUP_HEADER_H / 2,
        });
      }

      offset += GROUP_HEADER_H;

      // If group is expanded, compute field-level handles
      if (expandedGroupNames.has(group.tableName)) {
        offset += GROUP_PAD; // top padding

        const showAll = showAllGroupNames.has(group.tableName);
        const visibleCols = getVisibleColumns(group, columnFilter, showAll);
        for (const col of visibleCols) {
          if (col.referenceTable) {
            positions.push({
              id: `ref-field-${col.element}`,
              top: offset + FIELD_ROW_H / 2,
            });
          }
          offset += FIELD_ROW_H;
        }

        // "+N more" / "Show fewer" row (only when not filtering)
        if (!columnFilter && group.columns.length > MAX_VISIBLE_ROWS) {
          offset += FIELD_ROW_H;
        }

        offset += GROUP_PAD; // bottom padding
      }
    }

    return positions;
  }, [d.expanded, columnGroups, expandedGroupNames, showAllGroupNames, columnFilter]);

  // Notify React Flow when handles change so edges re-connect
  useEffect(() => {
    if (handlePositions.length > 0) {
      updateNodeInternals(id);
    }
  }, [handlePositions, id, updateNodeInternals]);

  // --- Handlers ---

  const handleToggle = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      d.onToggleExpand(id);
    },
    [id, d]
  );

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      d.onDoubleClick(d.name);
    },
    [d]
  );

  const toggleGroup = useCallback(
    (tableName: string, e: React.MouseEvent) => {
      e.stopPropagation();
      d.onToggleGroup(id, tableName);
    },
    [id, d]
  );

  // Fetch columns when expanded, grouped by inheritance level
  useEffect(() => {
    if (!d.expanded || columnGroups.length > 0) return;

    // eslint-disable-next-line react-hooks/set-state-in-effect -- data-fetching effect needs loading state
    setLoadingColumns(true);
    fetch(
      `/api/tables/${encodeURIComponent(d.name)}?snapshotId=${d.snapshotId}`
    )
      .then((r) => r.json())
      .then((detail) => {
        const allColumns: ColumnInfo[] = detail.columns || [];
        const inheritanceChain: { name: string; label: string }[] =
          detail.inheritanceChain || [];

        // Build label lookup
        const labelMap = new Map<string, string>();
        labelMap.set(d.name, d.label);
        for (const a of inheritanceChain) {
          labelMap.set(a.name, a.label);
        }

        // Order: own table first, then inheritance chain order
        const orderedTables = [
          d.name,
          ...inheritanceChain.map((a) => a.name),
        ];

        const groups: ColumnGroup[] = [];
        for (const tblName of orderedTables) {
          const cols = allColumns.filter(
            (c) => c.definedOnTable === tblName
          );
          if (cols.length > 0) {
            groups.push({
              tableName: tblName,
              tableLabel: labelMap.get(tblName) || tblName,
              columns: cols,
              isOwn: tblName === d.name,
              hasRefs: cols.some((c) => c.referenceTable != null),
            });
          }
        }

        setColumnGroups(groups);
        // Notify parent that columns have loaded (triggers edge recomputation)
        d.onColumnsLoaded(id, d.name);
      })
      .catch(console.error)
      .finally(() => setLoadingColumns(false));
  }, [d.expanded, d.name, d.label, d.snapshotId, columnGroups.length, id, d]);

  const borderColor = scopeColor(d.scopeName);

  return (
    <div
      className={`
        bg-background rounded-lg shadow-md border-2 transition-all duration-150
        ${d.isCenter ? "ring-2 ring-primary ring-offset-2" : ""}
        hover:shadow-lg
      `}
      style={{
        borderLeftWidth: 4,
        borderLeftColor: borderColor,
        width: 240,
      }}
      onDoubleClick={handleDoubleClick}
    >
      {/* Static handles — all 4 sides with IDs */}
      <Handle type="target" position={Position.Top} id="top"
        className="!bg-muted-foreground !w-2 !h-2" />
      <Handle type="source" position={Position.Bottom} id="bottom"
        className="!bg-muted-foreground !w-2 !h-2" />
      <Handle type="target" position={Position.Left} id="left"
        className="!bg-muted-foreground !w-1.5 !h-1.5" />
      <Handle type="source" position={Position.Right} id="right"
        className="!bg-muted-foreground !w-1.5 !h-1.5" />
      {/* Extra target on right side for reference edges from hierarchy peers */}
      <Handle type="target" position={Position.Right} id="right-target"
        className="!bg-muted-foreground !w-1.5 !h-1.5" style={{ top: '60%' }} />

      {/* Dynamic handles for reference edge pinning — pre-computed positions
          from column group structure, rendered at node level */}
      {handlePositions.map(({ id: handleId, top }) => (
        <Handle
          key={handleId}
          type="source"
          position={Position.Right}
          id={handleId}
          className="!bg-blue-500 !w-1.5 !h-1.5 !border-0"
          style={{ top }}
        />
      ))}

      {/* Header */}
      <div className="px-3 py-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-sm truncate">{d.label}</div>
            <div className="text-xs text-muted-foreground truncate">
              {d.name}
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {d.isTruncated && (
              <span
                className="text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 px-1.5 py-0.5 rounded-full font-medium"
                title="Has hidden children — double-click to explore"
              >
                +
              </span>
            )}
          </div>
        </div>

        {/* Metadata row */}
        <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
          <button
            onClick={handleToggle}
            className="flex items-center gap-0.5 hover:text-foreground transition-colors cursor-pointer"
          >
            {d.expanded ? (
              <ChevronDown className="w-3 h-3" />
            ) : (
              <ChevronRight className="w-3 h-3" />
            )}
            <Columns3 className="w-3 h-3" />
            <span>{d.totalColumnCount}</span>
          </button>
          {d.scopeLabel && (
            <span
              className="truncate max-w-[100px]"
              title={d.scopeLabel}
              style={{ color: borderColor }}
            >
              {d.scopeLabel}
            </span>
          )}
        </div>
      </div>

      {/* Expanded columns grouped by inheritance level */}
      {d.expanded && (
        <div className={`border-t ${d.isCenter ? "" : "max-h-[400px] overflow-y-auto nowheel"}`}>
          {loadingColumns ? (
            <div className="text-xs text-muted-foreground py-2 px-3">
              Loading columns...
            </div>
          ) : columnGroups.length === 0 ? (
            <div className="text-xs text-muted-foreground py-2 px-3">
              No columns
            </div>
          ) : (
            <>
              {/* Column filter input */}
              <div className="px-2 py-1 border-b flex items-center gap-1">
                <Search className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                <input
                  type="text"
                  className="nodrag nopan nowheel w-full text-[10px] px-1 py-0.5 rounded border bg-background placeholder:text-muted-foreground/60 outline-none focus:ring-1 focus:ring-ring/50"
                  placeholder="Filter columns..."
                  value={columnFilter}
                  onChange={(e) => {
                    e.stopPropagation();
                    d.onSetColumnFilter(id, e.target.value);
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>

              {columnGroups.map((group) => {
                const isExpanded = expandedGroupNames.has(group.tableName);
                const showAll = showAllGroupNames.has(group.tableName);
                const visibleCols = isExpanded
                  ? getVisibleColumns(group, columnFilter, showAll)
                  : [];
                const hasOverflow =
                  !columnFilter && group.columns.length > MAX_VISIBLE_ROWS;

                return (
                  <div key={group.tableName}>
                    {/* Group header */}
                    <button
                      onClick={(e) => toggleGroup(group.tableName, e)}
                      className={`
                        w-full flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold
                        border-b hover:bg-muted/50 transition-colors cursor-pointer
                        ${group.isOwn ? "text-foreground" : "text-muted-foreground"}
                      `}
                      style={
                        !group.isOwn
                          ? { color: "hsl(var(--destructive))", opacity: 0.8 }
                          : undefined
                      }
                    >
                      {isExpanded ? (
                        <Minus className="w-3 h-3 flex-shrink-0" />
                      ) : (
                        <Plus className="w-3 h-3 flex-shrink-0" />
                      )}
                      <span className={group.isOwn ? "" : "font-semibold"}>
                        {group.isOwn ? "Columns" : `${group.tableLabel} Columns`}
                      </span>
                    </button>

                    {/* Column list */}
                    {isExpanded && (
                      <div
                        className={`px-2 py-1 ${
                          group.isOwn ? "" : "bg-amber-50/50 dark:bg-amber-950/10"
                        }`}
                      >
                        <ul className="space-y-0">
                          {visibleCols.map((col) => {
                            const isRef = col.referenceTable != null;
                            const isHighlighted = isRef && d.highlightedRefField === col.element;
                            const isQuerySelected = d.querySelectedFields?.has(col.element);
                            return (
                              <li
                                key={col.element}
                                onClick={(e: React.MouseEvent) => {
                                  e.stopPropagation();
                                  // For reference fields, also trigger edge highlighting
                                  if (isRef) {
                                    d.onFieldClick(id, col.element);
                                  }
                                  // Always toggle query field selection
                                  d.onToggleQueryField(col);
                                }}
                                className={`
                                  flex items-center justify-between gap-2 text-xs py-0.5 px-1 rounded cursor-pointer
                                  ${isQuerySelected
                                    ? "bg-emerald-100 dark:bg-emerald-900/40 ring-1 ring-emerald-400/50"
                                    : isHighlighted
                                      ? "bg-blue-100 dark:bg-blue-900/40 ring-1 ring-blue-400/50"
                                      : isRef
                                        ? "hover:bg-blue-50 dark:hover:bg-blue-950/30"
                                        : "hover:bg-muted/50"
                                  }
                                `}
                              >
                                <span className="flex items-center gap-1 truncate min-w-0">
                                  {isQuerySelected && (
                                    <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                                  )}
                                  <span className="truncate">
                                    {col.label || col.element}:
                                  </span>
                                </span>
                                <span className="flex items-center gap-1 flex-shrink-0 text-muted-foreground">
                                  {isRef ? (
                                    <span className={`text-[10px] flex items-center gap-0.5 ${
                                      isHighlighted
                                        ? "text-blue-700 dark:text-blue-300 font-semibold"
                                        : "text-blue-600 dark:text-blue-400"
                                    }`}>
                                      reference
                                      <ArrowUpRight className="w-2.5 h-2.5" />
                                    </span>
                                  ) : (
                                    <span className="text-[10px]">
                                      {col.internalType}
                                    </span>
                                  )}
                                </span>
                              </li>
                            );
                          })}
                          {columnFilter && visibleCols.length === 0 && (
                            <li className="text-[10px] text-muted-foreground py-0.5 px-1">
                              No matches
                            </li>
                          )}
                          {hasOverflow && !showAll && (
                            <li
                              className="text-[10px] text-blue-600 dark:text-blue-400 py-0.5 px-1 cursor-pointer hover:underline"
                              onClick={(e) => {
                                e.stopPropagation();
                                d.onToggleShowAll(id, group.tableName);
                              }}
                            >
                              +{group.columns.length - MAX_VISIBLE_ROWS} more…
                            </li>
                          )}
                          {hasOverflow && showAll && (
                            <li
                              className="text-[10px] text-blue-600 dark:text-blue-400 py-0.5 px-1 cursor-pointer hover:underline"
                              onClick={(e) => {
                                e.stopPropagation();
                                d.onToggleShowAll(id, group.tableName);
                              }}
                            >
                              Show fewer
                            </li>
                          )}
                        </ul>
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export const TableNode = memo(TableNodeComponent);
