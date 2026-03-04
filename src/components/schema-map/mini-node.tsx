"use client";

import { memo, useCallback } from "react";
import { Handle, Position } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";

interface MiniNodeData {
  label: string;
  name: string;
  isCenter: boolean;
  isTruncated: boolean;
  totalColumnCount: number;
  onDoubleClick: (tableName: string) => void;
  [key: string]: unknown;
}

function MiniNodeComponent({ data }: NodeProps) {
  const d = data as unknown as MiniNodeData;

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      d.onDoubleClick(d.name);
    },
    [d]
  );

  return (
    <div
      className="bg-muted/80 rounded-md border border-border/60 px-3 py-1.5 cursor-pointer hover:bg-muted hover:border-border transition-colors"
      style={{ minWidth: 120 }}
      onDoubleClick={handleDoubleClick}
      title={`${d.label} (${d.name}) — double-click to explore`}
    >
      {/* Handles — all 4 sides with IDs */}
      <Handle type="target" position={Position.Top} id="top"
        className="!bg-transparent !border-0 !w-1 !h-1" />
      <Handle type="source" position={Position.Bottom} id="bottom"
        className="!bg-transparent !border-0 !w-1 !h-1" />
      <Handle type="target" position={Position.Left} id="left"
        className="!bg-transparent !border-0 !w-1 !h-1" />
      <Handle type="source" position={Position.Right} id="right"
        className="!bg-transparent !border-0 !w-1 !h-1" />

      <div className="flex items-center gap-1.5">
        <span className="text-xs text-muted-foreground truncate max-w-[140px] font-medium">
          {d.label}
        </span>
        {d.isTruncated && (
          <span className="text-[9px] text-amber-600 dark:text-amber-400 font-bold flex-shrink-0">
            +
          </span>
        )}
      </div>
    </div>
  );
}

export const MiniNode = memo(MiniNodeComponent);
