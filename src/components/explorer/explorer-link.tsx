"use client";

import Link from "next/link";
import { ExternalLink, Table2, Map } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Build a URL to the Schema Explorer with optional view mode and column highlight.
 */
export function buildExplorerUrl(
  tableName: string,
  viewMode?: "detail" | "map" | "graph",
  column?: string
): string {
  const params = new URLSearchParams();
  params.set("table", tableName);
  if (viewMode) params.set("viewMode", viewMode);
  if (column) params.set("column", column);
  return `/explorer?${params.toString()}`;
}

interface ExplorerLinkProps {
  tableName: string;
  column?: string;
  variant?: "icon" | "dropdown";
  className?: string;
}

/**
 * Reusable link component for navigating to the Schema Explorer.
 *
 * - `"icon"` variant: small icon button with tooltip, links to detail view.
 * - `"dropdown"` variant: dropdown menu with detail view and schema map options.
 */
export function ExplorerLink({
  tableName,
  column,
  variant = "icon",
  className,
}: ExplorerLinkProps) {
  if (variant === "dropdown") {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={`h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground ${className || ""}`}
          >
            <ExternalLink className="size-3.5" />
            Explorer
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem asChild>
            <Link href={buildExplorerUrl(tableName, "detail", column)}>
              <Table2 className="mr-2 size-4" />
              Open in Detail View
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={buildExplorerUrl(tableName, "map")}>
              <Map className="mr-2 size-4" />
              Open in Schema Map
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  // Icon variant (default)
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          href={buildExplorerUrl(tableName, "detail", column)}
          className={`inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent size-7 ${className || ""}`}
        >
          <ExternalLink className="size-3.5" />
        </Link>
      </TooltipTrigger>
      <TooltipContent>View in Explorer</TooltipContent>
    </Tooltip>
  );
}
