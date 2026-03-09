"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface GlossaryTooltipProps {
  /** The definition text to show on hover */
  definition: string;
  children: React.ReactNode;
}

/**
 * Wraps content with a tooltip showing a glossary definition on hover.
 * Used on the CSDM page to show definitions for domain labels.
 */
export function GlossaryTooltip({ definition, children }: GlossaryTooltipProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="underline decoration-dotted decoration-muted-foreground/50 underline-offset-4 cursor-help">
          {children}
        </span>
      </TooltipTrigger>
      <TooltipContent
        side="bottom"
        className="max-w-xs text-sm"
      >
        {definition}
      </TooltipContent>
    </Tooltip>
  );
}
