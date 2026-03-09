"use client";

import { cn } from "@/lib/utils";
import type { CsdmDomain } from "@/lib/csdm/data";

interface DomainChevronProps {
  domains: CsdmDomain[];
  activeDomainId: string | null;
  onSelect: (domainId: string) => void;
}

/**
 * Horizontal row of chevron-shaped buttons representing the CSDM domains.
 *
 * Each chevron is built with CSS clip-path:
 *  - First: flat left, arrow right
 *  - Middle: indented left, arrow right
 *  - Last: indented left, flat right
 */
export function DomainChevrons({
  domains,
  activeDomainId,
  onSelect,
}: DomainChevronProps) {
  return (
    <div className="flex items-stretch gap-1 overflow-x-auto">
      {domains.map((domain, index) => {
        const isActive = domain.id === activeDomainId;
        const isFirst = index === 0;
        const isLast = index === domains.length - 1;

        // Build clip-path based on position
        // indent = 8% from left for arrow notch, point = 92% on right for arrow tip
        const clipPath = getChevronClipPath(isFirst, isLast);

        return (
          <button
            key={domain.id}
            onClick={() => onSelect(domain.id)}
            className={cn(
              "relative flex-1 min-w-[160px] h-16 flex items-center justify-center",
              "text-sm font-semibold transition-all duration-200 uppercase tracking-wide",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              isActive
                ? "bg-blue-600 text-white shadow-md"
                : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
            )}
            style={{ clipPath }}
          >
            <span className={cn("px-4 text-center leading-tight", !isFirst && "pl-6")}>
              {domain.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function getChevronClipPath(isFirst: boolean, isLast: boolean): string {
  // Polygon points for chevron shapes:
  // The arrow notch on the left is at 6%, and the arrow point on the right is at 94%
  if (isFirst && isLast) {
    // Single chevron (unlikely, but defensive)
    return "polygon(0% 0%, 94% 0%, 100% 50%, 94% 100%, 0% 100%)";
  }
  if (isFirst) {
    // Flat left, arrow right
    return "polygon(0% 0%, 94% 0%, 100% 50%, 94% 100%, 0% 100%)";
  }
  if (isLast) {
    // Indented left, flat right
    return "polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%, 6% 50%)";
  }
  // Middle: indented left, arrow right
  return "polygon(0% 0%, 94% 0%, 100% 50%, 94% 100%, 0% 100%, 6% 50%)";
}
