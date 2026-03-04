"use client";

import { memo, useState, useEffect, useLayoutEffect, useCallback, useRef } from "react";
import { Handle, Position } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";
import {
  ChevronDown,
  ChevronRight,
  Columns3,
  ArrowUpRight,
  Minus,
  Plus,
} from "lucide-react";

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
  expandedGroupNames: Set<string>;
  [key: string]: unknown;
}

function TableNodeComponent({ id, data }: NodeProps) {
  const d = data as unknown as TableNodeData;
  const [columnGroups, setColumnGroups] = useState<ColumnGroup[]>([]);
  const [loadingColumns, setLoadingColumns] = useState(false);

  // Use lifted expandedGroupNames from parent (SchemaMap) instead of local state
  const expandedGroupNames = d.expandedGroupNames || new Set<string>();

  // --- Dynamic handle positioning ---
  // Handles must be at the node's top level so React Flow positions them at the
  // node's right edge. We measure group-header / field-row DOM offsets and
  // render Handle components with explicit `top` pixel values.
  const nodeRef = useRef<HTMLDivElement>(null);
  const [handleOffsets, setHandleOffsets] = useState<
    { id: string; top: number }[]
  >([]);

  // Stable key for expandedGroupNames so we can use it as a dependency
  const expandedGroupsKey = expandedGroupNames
    ? [...expandedGroupNames].sort().join(",")
    : "";

  // Measure positions of [data-handle-id] elements relative to the node
  useLayoutEffect(() => {
    if (!d.expanded || !nodeRef.current) {
      setHandleOffsets([]);
      return;
    }

    const nodeEl = nodeRef.current;
    const nodeRect = nodeEl.getBoundingClientRect();
    const els = nodeEl.querySelectorAll<HTMLElement>("[data-handle-id]");
    const offsets: { id: string; top: number }[] = [];

    els.forEach((el) => {
      const handleId = el.getAttribute("data-handle-id");
      if (!handleId) return;
      const elRect = el.getBoundingClientRect();
      // Center of the element, relative to the node's top edge
      offsets.push({
        id: handleId,
        top: elRect.top - nodeRect.top + elRect.height / 2,
      });
    });

    setHandleOffsets(offsets);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d.expanded, columnGroups, expandedGroupsKey]);

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
      ref={nodeRef}
      className={`
        bg-background rounded-lg shadow-md border-2 transition-all duration-150
        ${d.isCenter ? "ring-2 ring-primary ring-offset-2" : ""}
        hover:shadow-lg
      `}
      style={{
        borderLeftWidth: 4,
        borderLeftColor: borderColor,
        minWidth: 240,
        maxWidth: 320,
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

      {/* Dynamic handles for reference edge pinning — rendered at node level
          with measured top offsets so they sit at the node's right edge */}
      {handleOffsets.map(({ id: handleId, top }) => (
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
        <div className="border-t max-h-[400px] overflow-y-auto">
          {loadingColumns ? (
            <div className="text-xs text-muted-foreground py-2 px-3">
              Loading columns...
            </div>
          ) : columnGroups.length === 0 ? (
            <div className="text-xs text-muted-foreground py-2 px-3">
              No columns
            </div>
          ) : (
            columnGroups.map((group) => {
              const isExpanded = expandedGroupNames.has(group.tableName);
              return (
                <div key={group.tableName}>
                  {/* Group header — data-handle-id marks it for position measurement */}
                  <button
                    data-handle-id={
                      group.hasRefs
                        ? `ref-group-${group.tableName}`
                        : undefined
                    }
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
                        {group.columns.slice(0, 30).map((col) => (
                          <li
                            key={col.element}
                            data-handle-id={
                              col.referenceTable
                                ? `ref-field-${col.element}`
                                : undefined
                            }
                            className="flex items-center justify-between gap-2 text-xs py-0.5 px-1 rounded hover:bg-muted/50"
                          >
                            <span className="truncate min-w-0">
                              {col.label || col.element}:
                            </span>
                            <span className="flex items-center gap-1 flex-shrink-0 text-muted-foreground">
                              {col.referenceTable ? (
                                <span className="text-[10px] text-blue-600 dark:text-blue-400 flex items-center gap-0.5">
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
                        ))}
                        {group.columns.length > 30 && (
                          <li className="text-[10px] text-muted-foreground py-0.5 px-1">
                            +{group.columns.length - 30} more...
                          </li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

export const TableNode = memo(TableNodeComponent);
