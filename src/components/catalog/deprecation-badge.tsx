"use client";

import { AlertTriangle } from "lucide-react";

interface DeprecationBadgeProps {
  size?: "sm" | "md";
}

/**
 * Small "Deprecated" badge shown on catalog entry rows and detail headers.
 */
export function DeprecationBadge({ size = "sm" }: DeprecationBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border font-semibold ${
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-0.5 text-sm"
      } bg-red-100 text-red-700 border-red-300 dark:bg-red-950 dark:text-red-400 dark:border-red-800`}
    >
      <AlertTriangle className={size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} />
      Deprecated
    </span>
  );
}
