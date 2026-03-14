"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { ChevronDown, ChevronRight, X, RotateCcw, Search, Focus } from "lucide-react";
import type { GraphDepth, GraphDirection } from "@/stores/graph-store";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useGraphStore } from "@/stores/graph-store";
import { scopeHue } from "./canvas-graph";

export function FilterPanel() {
  const {
    viewMode,
    setViewMode,
    showOrphans,
    setShowOrphans,
    showLabels,
    setShowLabels,
    showHierarchy,
    setShowHierarchy,
    searchQuery,
    setSearchQuery,
    focusTable,
    setFocusTable,
    depth,
    setDepth,
    direction,
    setDirection,
    linkDistance,
    setLinkDistance,
    chargeStrength,
    setChargeStrength,
    hiddenScopes,
    setHiddenScopes,
    toggleScope,
    graphData,
  } = useGraphStore();

  const [open, setOpen] = useState(true);
  const [displayOpen, setDisplayOpen] = useState(false);
  const [forcesOpen, setForcesOpen] = useState(false);
  const [scopesOpen, setScopesOpen] = useState(false);

  // Debounced slider state — display updates immediately, store updates after 300ms
  const [displayLinkDistance, setDisplayLinkDistance] = useState(linkDistance);
  const [displayChargeStrength, setDisplayChargeStrength] = useState(chargeStrength);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => { setDisplayLinkDistance(linkDistance); }, [linkDistance]);
  useEffect(() => { setDisplayChargeStrength(chargeStrength); }, [chargeStrength]);
  useEffect(() => () => clearTimeout(debounceRef.current), []);

  const debouncedSetLinkDistance = useCallback((value: number) => {
    setDisplayLinkDistance(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setLinkDistance(value), 300);
  }, [setLinkDistance]);

  const debouncedSetChargeStrength = useCallback((value: number) => {
    setDisplayChargeStrength(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setChargeStrength(value), 300);
  }, [setChargeStrength]);

  const stats = graphData?.stats;

  // Derive scope list from graph data — sorted by count descending
  const scopeList = useMemo(() => {
    if (!graphData) return [];

    const scopeMap = new Map<string, { label: string; count: number }>();
    for (const node of graphData.nodes) {
      const key = node.scopeName ?? "__null__";
      const existing = scopeMap.get(key);
      if (existing) {
        existing.count++;
      } else {
        scopeMap.set(key, {
          label: node.scopeLabel ?? node.scopeName ?? "No scope",
          count: 1,
        });
      }
    }

    return Array.from(scopeMap.entries())
      .map(([key, { label, count }]) => ({
        key,
        scopeName: key === "__null__" ? null : key,
        label,
        count,
        hue: scopeHue(key === "__null__" ? null : key),
      }))
      .sort((a, b) => b.count - a.count);
  }, [graphData]);

  const visibleScopeCount = scopeList.length - hiddenScopes.size;

  return (
    <div className="absolute top-3 right-3 z-10 w-64">
      <div className="rounded-lg border bg-background/95 backdrop-blur-sm shadow-lg">
        {/* Header */}
        <div
          onClick={() => setOpen(!open)}
          className="flex w-full items-center justify-between px-3 py-2.5 text-sm font-semibold hover:bg-accent/50 rounded-t-lg cursor-pointer select-none"
        >
          <span>Filters</span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setSearchQuery("");
                setFocusTable(null);
                setDepth(2);
                setDirection("all");
                setShowOrphans(false);
                setLinkDistance(150);
                setChargeStrength(-300);
                setHiddenScopes(new Set());
              }}
              className="p-0.5 rounded hover:bg-accent"
              title="Reset filters"
            >
              <RotateCcw className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
            {open ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </div>

        {open && (
          <div className="px-3 pb-3 space-y-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search tables or fields..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-7 h-8 text-xs"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-2"
                >
                  <X className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              )}
            </div>

            {/* Stats */}
            {stats && (
              <div className="flex gap-1.5 flex-wrap">
                <Badge variant="secondary" className="text-[10px]">
                  {stats.totalTables} tables
                </Badge>
                <Badge variant="secondary" className="text-[10px]">
                  {stats.totalReferences} refs
                </Badge>
                <Badge variant="secondary" className="text-[10px]">
                  {stats.orphanCount} orphans
                </Badge>
              </div>
            )}

            {/* Focus section */}
            {focusTable && (
              <>
                <Separator />
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Focus className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="text-xs font-mono truncate" title={focusTable}>
                        {focusTable}
                      </span>
                    </div>
                    <button
                      onClick={() => setFocusTable(null)}
                      className="p-0.5 rounded hover:bg-accent shrink-0"
                      title="Clear focus"
                    >
                      <X className="h-3 w-3 text-muted-foreground" />
                    </button>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-muted-foreground shrink-0">Depth</span>
                    <div className="flex items-center rounded-md border bg-background p-0.5 flex-1">
                      {([1, 2, 3, "all"] as GraphDepth[]).map((d) => (
                        <button
                          key={String(d)}
                          onClick={() => setDepth(d)}
                          className={`flex-1 px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${
                            depth === d
                              ? "bg-primary text-primary-foreground shadow-sm"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {d === "all" ? "All" : d}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-muted-foreground shrink-0">Direction</span>
                    <div className="flex items-center rounded-md border bg-background p-0.5 flex-1">
                      {(["inbound", "all", "outbound"] as GraphDirection[]).map((d) => (
                        <button
                          key={d}
                          onClick={() => setDirection(d)}
                          className={`flex-1 px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${
                            direction === d
                              ? "bg-primary text-primary-foreground shadow-sm"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {d === "all" ? "Both" : d === "inbound" ? "← In" : "Out →"}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}

            <Separator />

            {/* Toggles */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Tables</span>
                <Switch checked={true} disabled />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Fields</span>
                <Switch
                  checked={viewMode === "fields"}
                  onCheckedChange={(checked) => setViewMode(checked ? "fields" : "tables")}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Hierarchy</span>
                <Switch
                  checked={showHierarchy}
                  onCheckedChange={setShowHierarchy}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Orphans</span>
                <Switch
                  checked={showOrphans}
                  onCheckedChange={setShowOrphans}
                />
              </div>
            </div>

            <Separator />

            {/* Display section */}
            <Collapsible open={displayOpen} onOpenChange={setDisplayOpen}>
              <CollapsibleTrigger className="flex w-full items-center justify-between py-1 text-xs font-medium hover:text-foreground text-muted-foreground">
                <span>Display</span>
                {displayOpen ? (
                  <ChevronDown className="h-3.5 w-3.5" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" />
                )}
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-2.5 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    Node labels
                  </span>
                  <Switch
                    checked={showLabels}
                    onCheckedChange={setShowLabels}
                  />
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Scopes section */}
            {scopeList.length > 0 && (
              <Collapsible open={scopesOpen} onOpenChange={setScopesOpen}>
                <CollapsibleTrigger className="flex w-full items-center justify-between py-1 text-xs font-medium hover:text-foreground text-muted-foreground">
                  <span>Scopes</span>
                  <div className="flex items-center gap-1.5">
                    <Badge variant="secondary" className="text-[9px] px-1 py-0">
                      {visibleScopeCount}/{scopeList.length}
                    </Badge>
                    {scopesOpen ? (
                      <ChevronDown className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5" />
                    )}
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-2 space-y-2">
                  {/* All / None quick toggles */}
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => setHiddenScopes(new Set())}
                      disabled={hiddenScopes.size === 0}
                      className="text-[10px] text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-default"
                    >
                      All
                    </button>
                    <span className="text-[10px] text-muted-foreground">/</span>
                    <button
                      onClick={() =>
                        setHiddenScopes(new Set(scopeList.map((s) => s.key)))
                      }
                      disabled={hiddenScopes.size >= scopeList.length}
                      className="text-[10px] text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-default"
                    >
                      None
                    </button>
                  </div>

                  {/* Scrollable scope list */}
                  <div className="max-h-[200px] overflow-y-auto space-y-0.5 pr-1">
                    {scopeList.map((scope) => {
                      const isHidden = hiddenScopes.has(scope.key);
                      return (
                        <button
                          key={scope.key}
                          onClick={() => toggleScope(scope.key)}
                          className={`flex items-center justify-between w-full text-left px-1.5 py-1 rounded text-xs transition-colors hover:bg-accent/50 ${
                            isHidden ? "opacity-40" : ""
                          }`}
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span
                              className="shrink-0 h-2.5 w-2.5 rounded-full"
                              style={{
                                backgroundColor: `hsl(${scope.hue}, 45%, 55%)`,
                              }}
                            />
                            <span className="truncate">{scope.label}</span>
                          </div>
                          <span className="text-[10px] text-muted-foreground tabular-nums shrink-0 ml-1">
                            {scope.count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* Forces section */}
            <Collapsible open={forcesOpen} onOpenChange={setForcesOpen}>
              <CollapsibleTrigger className="flex w-full items-center justify-between py-1 text-xs font-medium hover:text-foreground text-muted-foreground">
                <span>Forces</span>
                {forcesOpen ? (
                  <ChevronDown className="h-3.5 w-3.5" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" />
                )}
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-3 pt-2">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground">
                      Link distance
                    </span>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {displayLinkDistance}
                    </span>
                  </div>
                  <Slider
                    value={[displayLinkDistance]}
                    onValueChange={([v]) => debouncedSetLinkDistance(v)}
                    min={30}
                    max={400}
                    step={10}
                  />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground">
                      Repulsion
                    </span>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {Math.abs(displayChargeStrength)}
                    </span>
                  </div>
                  <Slider
                    value={[Math.abs(displayChargeStrength)]}
                    onValueChange={([v]) => debouncedSetChargeStrength(-v)}
                    min={50}
                    max={1000}
                    step={25}
                  />
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        )}
      </div>
    </div>
  );
}
