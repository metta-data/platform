"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { CSDM_DOMAINS, CSDM_FOUNDATION } from "@/lib/csdm/data";
import { DomainChevrons } from "@/components/csdm/domain-chevrons";
import { CsdmTableCard } from "@/components/csdm/csdm-table-card";
import { FoundationRow } from "@/components/csdm/foundation-row";
import { GlossaryTooltip } from "@/components/glossary/glossary-tooltip";

export default function CsdmPage() {
  return (
    <Suspense>
      <CsdmPageInner />
    </Suspense>
  );
}

function CsdmPageInner() {
  const searchParams = useSearchParams();
  const [activeDomainId, setActiveDomainId] = useState<string>(
    CSDM_DOMAINS.domains[0].id
  );

  // Support ?domain= query param for deep-linking from glossary
  useEffect(() => {
    const domainParam = searchParams.get("domain");
    if (
      domainParam &&
      CSDM_DOMAINS.domains.some((d) => d.id === domainParam)
    ) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing URL param to state on mount
      setActiveDomainId(domainParam);
    }
  }, [searchParams]);

  const activeDomain = CSDM_DOMAINS.domains.find(
    (d) => d.id === activeDomainId
  );

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto w-full px-6 py-8 space-y-6">
        {/* Page header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            CSDM Domains
            <span className="ml-2 align-middle inline-block rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5">
              Beta
            </span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Common Service Data Model — click a domain to explore its
            tables, then click a table to open it in the Schema Explorer.
          </p>
        </div>

        {/* Domain container label */}
        <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
          <GlossaryTooltip definition="The overarching process of governing, prioritizing, and aligning the service portfolio to business strategy.">
            {CSDM_DOMAINS.label}
          </GlossaryTooltip>
        </div>

        {/* Domain chevrons */}
        <DomainChevrons
          domains={CSDM_DOMAINS.domains}
          activeDomainId={activeDomainId}
          onSelect={setActiveDomainId}
        />

        {/* Selected domain content */}
        {activeDomain && (
          <div className="space-y-3">
            <div>
              <h2 className="text-lg font-semibold">{activeDomain.label}</h2>
              <p className="text-sm text-muted-foreground">
                {activeDomain.description}
              </p>
            </div>

            {activeDomain.tables.length > 0 ? (
              <div className="space-y-2">
                {activeDomain.tables.map((table) => (
                  <div key={table.name} className="max-w-xs">
                    <CsdmTableCard table={table} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                No tables mapped yet. Table data will be added from CSDM
                reference images.
              </div>
            )}
          </div>
        )}

        {/* Foundation row */}
        <FoundationRow domain={CSDM_FOUNDATION} />
      </div>
    </div>
  );
}
