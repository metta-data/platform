"use client";

import { X } from "lucide-react";

interface TagBadgeProps {
  name: string;
  color: string;
  onClick?: () => void;
  onRemove?: () => void;
  size?: "sm" | "md";
}

/**
 * Colored pill for displaying a tag.
 * Uses inline styles for dynamic hex color support.
 */
export function TagBadge({ name, color, onClick, onRemove, size = "sm" }: TagBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border font-medium ${
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-0.5 text-sm"
      } ${onClick ? "cursor-pointer hover:opacity-80" : ""}`}
      style={{
        backgroundColor: `${color}1A`,
        color: color,
        borderColor: `${color}40`,
      }}
      onClick={onClick}
      role={onClick ? "button" : undefined}
    >
      {name}
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-0.5 rounded-full p-0.5 hover:bg-black/10 dark:hover:bg-white/10"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </span>
  );
}

/** Compact overflow indicator for tag lists */
export function TagOverflow({ count }: { count: number }) {
  return (
    <span className="inline-flex items-center rounded-full border border-muted px-2 py-0.5 text-xs text-muted-foreground">
      +{count}
    </span>
  );
}
