import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type {
  ReferenceGraphNode,
  ReferenceGraphEdge,
  ReferenceGraphResponse,
} from "@/types/reference-graph";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const snapshotId = searchParams.get("snapshotId");

  if (!snapshotId) {
    return NextResponse.json(
      { error: "snapshotId is required" },
      { status: 400 }
    );
  }

  // 1. Fetch all tables in the snapshot (include superClassName for hierarchy)
  const allTables = await prisma.snapshotTable.findMany({
    where: { snapshotId },
    select: {
      name: true,
      label: true,
      scopeName: true,
      scopeLabel: true,
      totalColumnCount: true,
      superClassName: true,
    },
  });

  if (allTables.length === 0) {
    return NextResponse.json(
      { error: "Snapshot not found or has no tables" },
      { status: 404 }
    );
  }

  // Build lookup maps (same pattern as /api/graph)
  const tableMap = new Map(allTables.map((t) => [t.name, t]));
  const labelToName = new Map<string, string>();
  for (const t of allTables) {
    if (!labelToName.has(t.label)) {
      labelToName.set(t.label, t.name);
    }
  }

  // 2. Fetch all reference columns for this snapshot
  const refColumns = await prisma.snapshotColumn.findMany({
    where: {
      table: { snapshotId },
      referenceTable: { not: null },
    },
    select: {
      element: true,
      label: true,
      referenceTable: true,
      definedOnTable: true,
      table: { select: { name: true } },
    },
  });

  // 3. Group by (sourceTable, targetTable) pairs — reference edges
  const edgeMap = new Map<string, { element: string; label: string; definedOnTable: string }[]>();
  const inboundCounts = new Map<string, number>();
  const outboundCounts = new Map<string, number>();

  for (const col of refColumns) {
    if (!col.referenceTable) continue;

    const sourceTable = col.table.name;

    // Resolve referenceTable — may be stored as table name OR display label
    const refName = tableMap.has(col.referenceTable)
      ? col.referenceTable
      : labelToName.get(col.referenceTable) || null;

    if (!refName || !tableMap.has(refName)) continue;

    // Skip self-references for graph clarity (a table referencing itself)
    if (refName === sourceTable) continue;

    const edgeKey = `${sourceTable}→${refName}`;
    const existing = edgeMap.get(edgeKey) || [];
    existing.push({
      element: col.element,
      label: col.label,
      definedOnTable: col.definedOnTable || sourceTable,
    });
    edgeMap.set(edgeKey, existing);

    // Track degree counts
    outboundCounts.set(sourceTable, (outboundCounts.get(sourceTable) || 0) + 1);
    inboundCounts.set(refName, (inboundCounts.get(refName) || 0) + 1);
  }

  // 4. Build reference edges
  const edges: ReferenceGraphEdge[] = [];
  for (const [edgeKey, fields] of edgeMap) {
    const [source, target] = edgeKey.split("→");
    edges.push({ source, target, type: "reference", fields, weight: fields.length });
  }

  // 5. Build hierarchy edges (child → parent via superClassName)
  for (const t of allTables) {
    if (t.superClassName && tableMap.has(t.superClassName)) {
      edges.push({
        source: t.name,
        target: t.superClassName,
        type: "hierarchy",
        fields: [],
        weight: 1,
      });

      // Count hierarchy connections in degree
      outboundCounts.set(t.name, (outboundCounts.get(t.name) || 0) + 1);
      inboundCounts.set(t.superClassName, (inboundCounts.get(t.superClassName) || 0) + 1);
    }
  }

  // 6. Build nodes with degree counts
  const nodes: ReferenceGraphNode[] = allTables.map((t) => {
    const inbound = inboundCounts.get(t.name) || 0;
    const outbound = outboundCounts.get(t.name) || 0;
    return {
      name: t.name,
      label: t.label,
      scopeName: t.scopeName,
      scopeLabel: t.scopeLabel,
      totalColumnCount: t.totalColumnCount,
      inboundReferenceCount: inbound,
      outboundReferenceCount: outbound,
      degree: inbound + outbound,
      isOrphan: inbound === 0 && outbound === 0,
      superClassName: t.superClassName,
    };
  });

  const orphanCount = nodes.filter((n) => n.isOrphan).length;

  const response: ReferenceGraphResponse = {
    nodes,
    edges,
    stats: {
      totalTables: nodes.length,
      totalReferences: edges.length,
      orphanCount,
    },
  };

  return NextResponse.json(response);
}
