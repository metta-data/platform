"use client";

import { Shield } from "lucide-react";

interface ClassificationBadgeProps {
  name: string;
  color: string;
  severity: number;
  size?: "sm" | "md";
  onClick?: () => void;
}

/**
 * Colored badge for data classification/sensitivity labels.
 * High severity (>=3) uses a solid filled style; lower uses ghost/tinted.
 */
export function ClassificationBadge({
  name,
  color,
  severity,
  size = "sm",
  onClick,
}: ClassificationBadgeProps) {
  const isHighSeverity = severity >= 3;

  if (isHighSeverity) {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full border font-semibold ${
          size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-0.5 text-sm"
        } ${onClick ? "cursor-pointer hover:opacity-90" : ""}`}
        style={{
          backgroundColor: `${color}30`,
          color: color,
          borderColor: `${color}60`,
        }}
        onClick={onClick}
        role={onClick ? "button" : undefined}
      >
        <Shield className={size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} />
        {name}
      </span>
    );
  }

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
    </span>
  );
}

/** Compact overflow indicator for classification lists */
export function ClassificationOverflow({ count }: { count: number }) {
  return (
    <span className="inline-flex items-center rounded-full border border-muted px-2 py-0.5 text-xs text-muted-foreground">
      +{count}
    </span>
  );
}
