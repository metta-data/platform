"use client";

import { memo, useCallback, useMemo } from "react";
import { Handle, Position, useUpdateNodeInternals } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";
import { ChevronDown, ChevronRight, Check, Star, Search } from "lucide-react";
import { FIELD_ROW_H, FILTER_INPUT_H } from "./constants";

interface DotWalkColumn {
  element: string;
  label: string;
  internalType: string;
}

interface MiniNodeData {
  label: string;
  name: string;
  isCenter: boolean;
  isTruncated: boolean;
  totalColumnCount: number;
  onDoubleClick: (tableName: string) => void;
  // Dot-walk expansion props
  dotWalkExpanded: boolean;
  dotWalkColumns: DotWalkColumn[];
  dotWalkSelectedFields: Set<string>;
  dotWalkLoading: boolean;
  parentRefElement: string | null;
  displayColumn: string | null;
  onToggleDotWalkExpand: (tableName: string) => void;
  onToggleDotWalkField: (
    parentElement: string,
    child: { element: string; label: string }
  ) => void;
  // Column filter & show-all props
  columnFilter: string;
  onSetColumnFilter: (nodeId: string, filter: string) => void;
  showAllDotWalk: boolean;
  onToggleDotWalkShowAll: (tableName: string) => void;
  [key: string]: unknown;
}

const MAX_DOT_WALK_ROWS = 20;

// MiniNode header height: px-3 py-1.5 with text-xs
const MINI_HEADER_H = 28;
// Border-t on expanded section
const MINI_BORDER_T = 1;
// py-1 on expanded column container
const MINI_COL_PAD = 4;

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

function MiniNodeComponent({ id, data }: NodeProps) {
  const d = data as unknown as MiniNodeData;
  const updateNodeInternals = useUpdateNodeInternals();
  const columnFilter = d.columnFilter || "";
  const showAllDotWalk = d.showAllDotWalk || false;

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      d.onDoubleClick(d.name);
    },
    [d]
  );

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      // Only expand if there's a parent reference element selected
      if (d.parentRefElement) {
        d.onToggleDotWalkExpand(d.name);
      }
    },
    [d]
  );

  const isExpandable = !!d.parentRefElement;
  const isExpanded = d.dotWalkExpanded && isExpandable;

  // Sort columns: display column first, then alphabetical by label
  const sortedColumns = useMemo(() => {
    if (!d.displayColumn || d.dotWalkColumns.length === 0) return d.dotWalkColumns;
    const displayCol = d.dotWalkColumns.find((c) => c.element === d.displayColumn);
    if (!displayCol) return d.dotWalkColumns;
    return [displayCol, ...d.dotWalkColumns.filter((c) => c.element !== d.displayColumn)];
  }, [d.dotWalkColumns, d.displayColumn]);

  // Derive visible columns accounting for filter and show-all
  const visibleColumns = useMemo(() => {
    let cols = sortedColumns;
    if (columnFilter) {
      cols = cols.filter((c) => matchesFilter(c, columnFilter));
    }
    if (!columnFilter && !showAllDotWalk) {
      return cols.slice(0, MAX_DOT_WALK_ROWS);
    }
    return cols;
  }, [sortedColumns, columnFilter, showAllDotWalk]);

  const hasOverflow = !columnFilter && sortedColumns.length > MAX_DOT_WALK_ROWS;

  // Compute display column target handle position
  const displayTargetHandleTop = useMemo(() => {
    if (!isExpanded || !d.displayColumn || d.dotWalkLoading || visibleColumns.length === 0) {
      return null;
    }
    const rowIndex = visibleColumns.findIndex((c) => c.element === d.displayColumn);
    if (rowIndex === -1) return null;

    // header + border + filter input + container padding + row offset + half row height
    return MINI_HEADER_H + MINI_BORDER_T + FILTER_INPUT_H + MINI_COL_PAD + rowIndex * FIELD_ROW_H + FIELD_ROW_H / 2;
  }, [isExpanded, d.displayColumn, d.dotWalkLoading, visibleColumns]);

  // Notify React Flow when handles change
  useMemo(() => {
    // Trigger on next tick so the DOM has updated
    requestAnimationFrame(() => updateNodeInternals(id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayTargetHandleTop, id]);

  return (
    <div
      className={`bg-muted/80 rounded-md border transition-colors ${
        isExpandable
          ? "border-emerald-400/60 hover:border-emerald-500 cursor-pointer"
          : "border-border/60 hover:border-border cursor-pointer"
      }`}
      style={{ width: isExpanded ? 220 : 160 }}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      title={
        isExpandable
          ? `${d.label} (${d.name}) — click to ${isExpanded ? "collapse" : "expand"} for dot-walking, double-click to explore`
          : `${d.label} (${d.name}) — double-click to explore`
      }
    >
      {/* Handles — all 4 sides with IDs */}
      <Handle
        type="target"
        position={Position.Top}
        id="top"
        className="!bg-transparent !border-0 !w-1 !h-1"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        className="!bg-transparent !border-0 !w-1 !h-1"
      />
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        className="!bg-transparent !border-0 !w-1 !h-1"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        className="!bg-transparent !border-0 !w-1 !h-1"
      />
      {/* Extra target on right side for reference edges from hierarchy peers */}
      <Handle
        type="target"
        position={Position.Right}
        id="right-target"
        className="!bg-transparent !border-0 !w-1 !h-1"
        style={{ top: "60%" }}
      />

      {/* Dynamic target handle pinned to display column row */}
      {displayTargetHandleTop != null && (
        <Handle
          type="target"
          position={Position.Left}
          id="ref-target-display"
          className="!bg-transparent !border-0 !w-1 !h-1"
          style={{ top: displayTargetHandleTop }}
        />
      )}

      {/* Header */}
      <div className="flex items-center gap-1.5 px-3 py-1.5">
        {isExpandable && (
          <span className="flex-shrink-0 text-emerald-600 dark:text-emerald-400">
            {isExpanded ? (
              <ChevronDown className="w-3 h-3" />
            ) : (
              <ChevronRight className="w-3 h-3" />
            )}
          </span>
        )}
        <span className="text-xs text-muted-foreground truncate font-medium">
          {d.label}
        </span>
        {d.isTruncated && (
          <span className="text-[9px] text-amber-600 dark:text-amber-400 font-bold flex-shrink-0">
            +
          </span>
        )}
      </div>

      {/* Expanded column list for dot-walking */}
      {isExpanded && (
        <div className="border-t border-border/40">
          {d.dotWalkLoading ? (
            <div className="text-[10px] text-muted-foreground py-1 px-1 animate-pulse">
              Loading columns...
            </div>
          ) : sortedColumns.length === 0 ? (
            <div className="text-[10px] text-muted-foreground py-1 px-1">
              No columns
            </div>
          ) : (
            <>
              {/* Column filter input */}
              <div className="px-2 py-1 border-b border-border/40 flex items-center gap-1">
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

              <div className="px-2 py-1 max-h-[300px] overflow-y-auto nowheel">
                <ul className="space-y-0">
                  {visibleColumns.map((col) => {
                    const isSelected = d.dotWalkSelectedFields?.has(col.element);
                    const isDisplayCol = d.displayColumn === col.element;
                    return (
                      <li
                        key={col.element}
                        onClick={(e: React.MouseEvent) => {
                          e.stopPropagation();
                          if (d.parentRefElement) {
                            d.onToggleDotWalkField(d.parentRefElement, {
                              element: col.element,
                              label: col.label,
                            });
                          }
                        }}
                        className={`
                          flex items-center justify-between gap-1 text-[11px] rounded cursor-pointer
                          ${
                            isSelected
                              ? "bg-emerald-100 dark:bg-emerald-900/40 ring-1 ring-emerald-400/50"
                              : isDisplayCol
                                ? "bg-blue-50 dark:bg-blue-950/30 ring-1 ring-blue-300/50"
                                : "hover:bg-muted"
                          }
                        `}
                        style={{ height: FIELD_ROW_H, padding: "0 4px" }}
                      >
                        <span className="flex items-center gap-1 truncate min-w-0">
                          {isSelected && (
                            <Check className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                          )}
                          {isDisplayCol && !isSelected && (
                            <Star className="w-2.5 h-2.5 text-blue-500 dark:text-blue-400 flex-shrink-0" />
                          )}
                          <span className="truncate">{col.label || col.element}</span>
                        </span>
                        <span className="flex items-center gap-1 flex-shrink-0">
                          {isDisplayCol && (
                            <span className="text-[8px] text-blue-600 dark:text-blue-400 font-semibold">
                              display
                            </span>
                          )}
                          <span className="text-[9px] text-muted-foreground">
                            {col.internalType}
                          </span>
                        </span>
                      </li>
                    );
                  })}
                  {columnFilter && visibleColumns.length === 0 && (
                    <li className="text-[9px] text-muted-foreground py-0.5 px-1">
                      No matches
                    </li>
                  )}
                  {hasOverflow && !showAllDotWalk && (
                    <li
                      className="text-[9px] text-blue-600 dark:text-blue-400 py-0.5 px-1 cursor-pointer hover:underline"
                      onClick={(e) => {
                        e.stopPropagation();
                        d.onToggleDotWalkShowAll(d.name);
                      }}
                    >
                      +{sortedColumns.length - MAX_DOT_WALK_ROWS} more…
                    </li>
                  )}
                  {hasOverflow && showAllDotWalk && (
                    <li
                      className="text-[9px] text-blue-600 dark:text-blue-400 py-0.5 px-1 cursor-pointer hover:underline"
                      onClick={(e) => {
                        e.stopPropagation();
                        d.onToggleDotWalkShowAll(d.name);
                      }}
                    >
                      Show fewer
                    </li>
                  )}
                </ul>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export const MiniNode = memo(MiniNodeComponent);
