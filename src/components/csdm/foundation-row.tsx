"use client";

import type { CsdmDomain } from "@/lib/csdm/data";
import { CsdmTableCard } from "./csdm-table-card";

interface FoundationRowProps {
  domain: CsdmDomain;
  /** Set of table names present in the current snapshot */
  snapshotTableNames?: Set<string>;
}

/**
 * Renders the CSDM Foundation row — a horizontal band of cross-cutting
 * foundational tables that span all lifecycle phases.
 */
export function FoundationRow({ domain, snapshotTableNames }: FoundationRowProps) {
  return (
    <div className="rounded-lg border bg-slate-50 p-4">
      <div className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">
        {domain.label}
      </div>
      <div className="flex flex-wrap gap-3">
        {domain.tables.map((table) => (
          <div key={table.name} className="flex-1 min-w-[180px] max-w-[240px]">
            <CsdmTableCard
              table={table}
              existsInSnapshot={
                snapshotTableNames ? snapshotTableNames.has(table.name) : undefined
              }
            />
          </div>
        ))}
      </div>
    </div>
  );
}
