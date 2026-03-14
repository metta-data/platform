"use client";

import { useState } from "react";
import { X, ArrowRight, ExternalLink, Copy, Check, GitBranch } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { useGraphStore } from "@/stores/graph-store";
import type { ReferenceGraphEdge } from "@/types";

interface EdgeInfoPanelProps {
  edge: ReferenceGraphEdge;
  onSelectNode: (name: string) => void;
}

export function EdgeInfoPanel({ edge, onSelectNode }: EdgeInfoPanelProps) {
  const { setSelectedEdge } = useGraphStore();
  const [copied, setCopied] = useState(false);

  const isHierarchy = edge.type === "hierarchy";

  const handleCopyFields = async () => {
    const lines = edge.fields.map(
      (f) => `${edge.source}.${f.element} → ${edge.target} (${f.label})`
    );
    await navigator.clipboard.writeText(lines.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="absolute bottom-3 left-3 z-10 w-72">
      <div className="rounded-lg border bg-background/95 backdrop-blur-sm shadow-lg">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2.5">
          <div className="flex items-center gap-1.5 min-w-0 text-sm font-semibold">
            <span className="truncate">{edge.source}</span>
            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="truncate">{edge.target}</span>
          </div>
          <div className="flex items-center gap-0.5 shrink-0">
            {edge.fields.length > 0 && (
              <button
                onClick={handleCopyFields}
                className="p-1 rounded hover:bg-accent"
                title="Copy field list"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-green-400" />
                ) : (
                  <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </button>
            )}
            <button
              onClick={() => setSelectedEdge(null)}
              className="p-1 rounded hover:bg-accent"
            >
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </div>
        </div>

        <div className="px-3 pb-3 space-y-2.5">
          {/* Edge type badge */}
          <div className="flex gap-1.5">
            {isHierarchy ? (
              <Badge variant="outline" className="text-[10px] text-cyan-400 border-cyan-400/30">
                <GitBranch className="h-2.5 w-2.5 mr-0.5" />
                Hierarchy
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] text-pink-400 border-pink-400/30">
                Reference
              </Badge>
            )}
            {edge.fields.length > 0 && (
              <Badge variant="secondary" className="text-[10px]">
                {edge.fields.length} {edge.fields.length === 1 ? "field" : "fields"}
              </Badge>
            )}
          </div>

          {/* Field list */}
          {edge.fields.length > 0 && (
            <>
              <Separator />
              <div>
                <div className="text-[10px] font-medium text-muted-foreground mb-1.5">
                  Fields
                </div>
                <div className="space-y-0.5 max-h-40 overflow-y-auto">
                  {edge.fields.map((f) => (
                    <div
                      key={f.element}
                      className="flex items-center justify-between text-[11px] px-1.5 py-0.5 rounded hover:bg-accent"
                    >
                      <div className="min-w-0">
                        <span className="font-mono text-foreground">{f.element}</span>
                        {f.label !== f.element && (
                          <span className="text-muted-foreground ml-1">({f.label})</span>
                        )}
                      </div>
                      {f.definedOnTable !== edge.source && (
                        <span
                          className="text-[9px] text-muted-foreground shrink-0 ml-1"
                          title={`Inherited from ${f.definedOnTable}`}
                        >
                          ← {f.definedOnTable}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {isHierarchy && (
            <>
              <Separator />
              <div className="text-[11px] text-muted-foreground">
                <span className="font-mono">{edge.source}</span> extends{" "}
                <span className="font-mono">{edge.target}</span>
              </div>
            </>
          )}

          <Separator />

          {/* Navigation buttons */}
          <div className="flex gap-1.5">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 h-7 text-xs"
              onClick={() => onSelectNode(edge.source)}
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              {edge.source}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 h-7 text-xs"
              onClick={() => onSelectNode(edge.target)}
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              {edge.target}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
