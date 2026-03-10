"use client";

import { type NodeRendererProps } from "react-arborist";
import { Badge } from "@/components/ui/badge";
import type { TreeTableNode } from "@/types";

interface TreeNodeData {
  id: string;
  name: string;
  data: TreeTableNode;
  children: TreeNodeData[];
}

export function TreeNodeRenderer({
  node,
  style,
  dragHandle,
}: NodeRendererProps<TreeNodeData>) {
  const table = node.data.data;
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div
      ref={dragHandle}
      style={style}
      className={`flex items-center gap-1.5 pl-2 pr-5 cursor-pointer rounded-sm group
        ${node.isSelected ? "bg-accent" : "hover:bg-accent/50"}`}
      onClick={(e) => {
        e.stopPropagation();
        if (hasChildren) {
          node.toggle();
        }
        node.select();
      }}
    >
      {/* Expand/collapse indicator */}
      <span className="w-4 text-xs text-muted-foreground flex-shrink-0">
        {hasChildren ? (node.isOpen ? "▾" : "▸") : ""}
      </span>

      {/* Table name */}
      <span className="text-sm font-mono truncate">{table.name}</span>

      {/* Table label (if different from name) */}
      {table.label && table.label !== table.name && (
        <span className="text-xs text-muted-foreground truncate hidden group-hover:inline">
          {table.label}
        </span>
      )}

      {/* Column count badge */}
      <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4 ml-auto flex-shrink-0">
        {table.ownColumnCount}
      </Badge>

      {/* Child table count */}
      {table.childTableCount > 0 && (
        <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 flex-shrink-0">
          +{table.childTableCount}
        </Badge>
      )}
    </div>
  );
}
