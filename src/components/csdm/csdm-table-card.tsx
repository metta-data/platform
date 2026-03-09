"use client";

import Link from "next/link";
import type { CsdmTable } from "@/lib/csdm/data";

interface CsdmTableCardProps {
  table: CsdmTable;
  /** Whether this table exists in the currently selected snapshot */
  existsInSnapshot?: boolean;
}

/**
 * A clickable card representing a single CSDM table.
 * Links to the Schema Explorer with the table pre-selected.
 */
export function CsdmTableCard({ table, existsInSnapshot }: CsdmTableCardProps) {
  const available = existsInSnapshot !== false; // default true if unknown

  return (
    <Link
      href={`/explorer?table=${encodeURIComponent(table.name)}`}
      className={
        "group block rounded-lg border px-4 py-3 transition-all " +
        (available
          ? "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/50 hover:bg-amber-100 dark:hover:bg-amber-900/40 hover:border-amber-300 dark:hover:border-amber-700/60 hover:shadow-sm cursor-pointer"
          : "bg-muted/50 border-muted cursor-default opacity-60")
      }
    >
      <div className="font-semibold text-sm text-foreground group-hover:text-amber-900 dark:group-hover:text-amber-200 transition-colors">
        {table.label}
      </div>
      <div className="text-xs text-muted-foreground font-mono mt-0.5">
        ({table.name})
      </div>
    </Link>
  );
}
