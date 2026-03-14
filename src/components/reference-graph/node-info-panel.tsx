"use client";

import { useState, useMemo } from "react";
import {
  X,
  ArrowDownLeft,
  ArrowUpRight,
  ExternalLink,
  Focus,
  GitBranch,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { useGraphStore } from "@/stores/graph-store";
import { useExplorerStore } from "@/stores/explorer-store";
import type { ReferenceGraphNode, ReferenceGraphEdge } from "@/types";

interface NodeInfoPanelProps {
  node: ReferenceGraphNode;
  edges: ReferenceGraphEdge[];
  onSelectNode: (name: string) => void;
}

/** Expandable edge row — shows table name collapsed, field list expanded */
function EdgeRow({
  edge,
  connectedTable,
  onSelectNode,
}: {
  edge: ReferenceGraphEdge;
  /** The "other" table in this edge (source for inbound, target for outbound) */
  connectedTable: string;
  onSelectNode: (name: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded hover:bg-accent/50 transition-colors">
      {/* Collapsed row — table name + field count */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          setExpanded(!expanded);
        }}
        className="flex items-center justify-between w-full text-left px-1.5 py-1 text-xs gap-1"
      >
        <div className="flex items-center gap-1 min-w-0">
          {expanded ? (
            <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
          ) : (
            <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
          )}
          <span className="truncate">{connectedTable}</span>
        </div>
        <Badge variant="secondary" className="text-[9px] px-1 py-0 shrink-0">
          {edge.fields.length} {edge.fields.length === 1 ? "field" : "fields"}
        </Badge>
      </button>

      {/* Expanded field list */}
      {expanded && (
        <div className="pl-5 pr-1.5 pb-1.5 space-y-0.5">
          {edge.fields.map((f) => (
            <div
              key={f.element}
              className="flex items-center justify-between text-[11px] px-1 py-0.5 rounded hover:bg-accent"
            >
              <div className="min-w-0">
                <span className="font-mono text-foreground">{f.element}</span>
                {f.label !== f.element && (
                  <span className="text-muted-foreground ml-1">({f.label})</span>
                )}
              </div>
              {f.definedOnTable !== edge.source && (
                <span className="text-[9px] text-muted-foreground shrink-0 ml-1" title="Inherited from">
                  ← {f.definedOnTable}
                </span>
              )}
            </div>
          ))}
          {/* Navigate to this table */}
          <button
            onClick={() => onSelectNode(connectedTable)}
            className="flex items-center gap-1 text-[10px] text-pink-400 hover:text-pink-300 mt-1 px-1"
          >
            <ExternalLink className="h-2.5 w-2.5" />
            View {connectedTable}
          </button>
        </div>
      )}
    </div>
  );
}

export function NodeInfoPanel({ node, edges, onSelectNode }: NodeInfoPanelProps) {
  const { setSelectedNode, setFocusTable } = useGraphStore();
  const { setViewMode: setExplorerViewMode, setSelectedTable } = useExplorerStore();
  const [copied, setCopied] = useState(false);

  // Compute connected tables — split by type
  const inboundRefEdges = useMemo(
    () => edges.filter((e) => e.target === node.name && e.type === "reference"),
    [edges, node.name]
  );
  const outboundRefEdges = useMemo(
    () => edges.filter((e) => e.source === node.name && e.type === "reference"),
    [edges, node.name]
  );

  // Total field counts for section headers
  const totalInboundFields = useMemo(
    () => inboundRefEdges.reduce((sum, e) => sum + e.fields.length, 0),
    [inboundRefEdges]
  );
  const totalOutboundFields = useMemo(
    () => outboundRefEdges.reduce((sum, e) => sum + e.fields.length, 0),
    [outboundRefEdges]
  );

  // Hierarchy: parent (this table extends) and children (tables that extend this)
  const parentEdge = edges.find((e) => e.source === node.name && e.type === "hierarchy");
  const childEdges = edges.filter((e) => e.target === node.name && e.type === "hierarchy");

  // Copy all referencing field info to clipboard
  const handleCopyFields = async () => {
    const lines: string[] = [];
    if (inboundRefEdges.length > 0) {
      lines.push(`Fields referencing ${node.name}:`);
      for (const e of inboundRefEdges) {
        for (const f of e.fields) {
          lines.push(`  ${e.source}.${f.element} (${f.label})`);
        }
      }
    }
    if (outboundRefEdges.length > 0) {
      if (lines.length > 0) lines.push("");
      lines.push(`Fields on ${node.name} referencing other tables:`);
      for (const e of outboundRefEdges) {
        for (const f of e.fields) {
          lines.push(`  ${f.element} → ${e.target} (${f.label})`);
        }
      }
    }
    await navigator.clipboard.writeText(lines.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="absolute bottom-3 left-3 z-10 w-80">
      <div className="rounded-lg border bg-background/95 backdrop-blur-sm shadow-lg max-h-[70vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2.5 shrink-0">
          <div className="min-w-0">
            <div className="text-sm font-semibold truncate">{node.label}</div>
            <div className="text-[11px] text-muted-foreground font-mono truncate">
              {node.name}
            </div>
          </div>
          <div className="flex items-center gap-0.5 shrink-0">
            {(inboundRefEdges.length > 0 || outboundRefEdges.length > 0) && (
              <button
                onClick={handleCopyFields}
                className="p-1 rounded hover:bg-accent"
                title="Copy field reference list"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-green-400" />
                ) : (
                  <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </button>
            )}
            <button
              onClick={() => setSelectedNode(null)}
              className="p-1 rounded hover:bg-accent"
            >
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="px-3 pb-3 space-y-2.5 overflow-y-auto min-h-0">
          {/* Stats */}
          <div className="flex gap-1.5 flex-wrap">
            {node.scopeLabel && (
              <Badge variant="outline" className="text-[10px]">
                {node.scopeLabel}
              </Badge>
            )}
            <Badge variant="secondary" className="text-[10px]">
              {node.totalColumnCount} columns
            </Badge>
            <Badge variant="secondary" className="text-[10px]">
              <ArrowDownLeft className="h-2.5 w-2.5 mr-0.5" />
              {node.inboundReferenceCount} in
            </Badge>
            <Badge variant="secondary" className="text-[10px]">
              <ArrowUpRight className="h-2.5 w-2.5 mr-0.5" />
              {node.outboundReferenceCount} out
            </Badge>
          </div>

          {/* Impact summary — quick at-a-glance dependency counts */}
          {(inboundRefEdges.length > 0 || outboundRefEdges.length > 0) && (
            <div className="rounded-md bg-accent/30 px-2.5 py-2 space-y-1">
              {inboundRefEdges.length > 0 && (
                <div className="flex items-center gap-1.5 text-[11px]">
                  <ArrowDownLeft className="h-3 w-3 text-pink-400 shrink-0" />
                  <span className="text-muted-foreground">Referenced by</span>
                  <span className="font-medium">{inboundRefEdges.length} tables</span>
                  <span className="text-muted-foreground">·</span>
                  <span className="font-medium">{totalInboundFields} fields</span>
                </div>
              )}
              {outboundRefEdges.length > 0 && (
                <div className="flex items-center gap-1.5 text-[11px]">
                  <ArrowUpRight className="h-3 w-3 text-blue-400 shrink-0" />
                  <span className="text-muted-foreground">References</span>
                  <span className="font-medium">{outboundRefEdges.length} tables</span>
                  <span className="text-muted-foreground">·</span>
                  <span className="font-medium">{totalOutboundFields} fields</span>
                </div>
              )}
            </div>
          )}

          {/* Hierarchy: parent table */}
          {(parentEdge || childEdges.length > 0) && (
            <>
              <Separator />
              <div>
                <div className="text-[10px] font-medium text-cyan-400 mb-1.5 flex items-center gap-1">
                  <GitBranch className="h-3 w-3" />
                  Hierarchy
                </div>
                {parentEdge && (
                  <div className="mb-1">
                    <div className="text-[10px] text-muted-foreground mb-0.5">Extends</div>
                    <button
                      onClick={() => onSelectNode(parentEdge.target)}
                      className="flex items-center w-full text-left px-1.5 py-0.5 rounded hover:bg-accent text-xs"
                    >
                      <span className="truncate">{parentEdge.target}</span>
                    </button>
                  </div>
                )}
                {childEdges.length > 0 && (
                  <div>
                    <div className="text-[10px] text-muted-foreground mb-0.5">
                      Extended by ({childEdges.length})
                    </div>
                    <div className="space-y-0.5 max-h-20 overflow-y-auto">
                      {childEdges.map((e) => (
                        <button
                          key={e.source}
                          onClick={() => onSelectNode(e.source)}
                          className="flex items-center w-full text-left px-1.5 py-0.5 rounded hover:bg-accent text-xs"
                        >
                          <span className="truncate">{e.source}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Inbound reference connections — expandable per edge */}
          {inboundRefEdges.length > 0 && (
            <>
              <Separator />
              <div>
                <div className="text-[10px] font-medium text-muted-foreground mb-1.5 flex items-center justify-between">
                  <span>
                    Referenced by ({inboundRefEdges.length}{" "}
                    {inboundRefEdges.length === 1 ? "table" : "tables"})
                  </span>
                  <span className="text-pink-400 font-mono">
                    {totalInboundFields} {totalInboundFields === 1 ? "field" : "fields"}
                  </span>
                </div>
                <div className="space-y-0.5 max-h-48 overflow-y-auto">
                  {inboundRefEdges.map((e) => (
                    <EdgeRow
                      key={e.source}
                      edge={e}
                      connectedTable={e.source}
                      onSelectNode={onSelectNode}
                    />
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Outbound reference connections — expandable per edge */}
          {outboundRefEdges.length > 0 && (
            <>
              <Separator />
              <div>
                <div className="text-[10px] font-medium text-muted-foreground mb-1.5 flex items-center justify-between">
                  <span>
                    References ({outboundRefEdges.length}{" "}
                    {outboundRefEdges.length === 1 ? "table" : "tables"})
                  </span>
                  <span className="text-pink-400 font-mono">
                    {totalOutboundFields} {totalOutboundFields === 1 ? "field" : "fields"}
                  </span>
                </div>
                <div className="space-y-0.5 max-h-48 overflow-y-auto">
                  {outboundRefEdges.map((e) => (
                    <EdgeRow
                      key={e.target}
                      edge={e}
                      connectedTable={e.target}
                      onSelectNode={onSelectNode}
                    />
                  ))}
                </div>
              </div>
            </>
          )}

          <Separator />

          {/* Action buttons */}
          <div className="flex gap-1.5">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 h-7 text-xs"
              onClick={() => {
                setFocusTable(node.name);
              }}
            >
              <Focus className="h-3 w-3 mr-1" />
              Focus
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 h-7 text-xs"
              onClick={() => {
                setSelectedTable(node.name);
                setExplorerViewMode("detail");
                setSelectedNode(null);
              }}
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              Detail
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
