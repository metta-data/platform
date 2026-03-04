import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { GraphNode, GraphEdge, GraphResponse } from "@/types/graph";

const MAX_NODES = 250;
// How many extra levels of hierarchy to show as mini (gray) nodes beyond the detail depth
const HIERARCHY_EXTRA_DEPTH = 4;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const snapshotId = searchParams.get("snapshotId");
  const centerTable = searchParams.get("centerTable");
  const depth = Math.min(parseInt(searchParams.get("depth") || "2", 10), 5);
  const includeRefs = searchParams.get("includeRefs") !== "false";

  if (!snapshotId || !centerTable) {
    return NextResponse.json(
      { error: "snapshotId and centerTable are required" },
      { status: 400 }
    );
  }

  // Fetch all tables in the snapshot (we need superClassName for traversal)
  const allTables = await prisma.snapshotTable.findMany({
    where: { snapshotId },
    select: {
      name: true,
      label: true,
      superClassName: true,
      scopeName: true,
      scopeLabel: true,
      ownColumnCount: true,
      totalColumnCount: true,
      childTableCount: true,
      isExtendable: true,
    },
  });

  // Build lookup maps
  const tableMap = new Map(allTables.map((t) => [t.name, t]));
  // Label → name map: referenceTable may be stored as display label (e.g. "Asset")
  // instead of table name (e.g. "alm_asset") due to sysparm_display_value=all
  const labelToName = new Map<string, string>();
  for (const t of allTables) {
    // Only set if label isn't already taken (labels aren't guaranteed unique,
    // but name→name takes priority via tableMap check in resolveRefTable)
    if (!labelToName.has(t.label)) {
      labelToName.set(t.label, t.name);
    }
  }
  const childrenMap = new Map<string, string[]>();
  for (const t of allTables) {
    if (t.superClassName) {
      const children = childrenMap.get(t.superClassName) || [];
      children.push(t.name);
      childrenMap.set(t.superClassName, children);
    }
  }

  const center = tableMap.get(centerTable);
  if (!center) {
    return NextResponse.json({ error: "Table not found" }, { status: 404 });
  }

  // Track distance from center for each included node
  // distance 0 = center, 1 = parent/direct children, 2 = grandparent/grandchildren, etc.
  const nodeDistance = new Map<string, number>();
  const edges: GraphEdge[] = [];

  // Center table is distance 0
  nodeDistance.set(centerTable, 0);

  // 1. Walk UP the inheritance chain (all ancestors)
  // Each ancestor is 1 more distant than its child
  let current = centerTable;
  let ancestorDist = 0;
  while (current) {
    const table = tableMap.get(current);
    if (table?.superClassName && tableMap.has(table.superClassName)) {
      ancestorDist++;
      const existingDist = nodeDistance.get(table.superClassName);
      if (existingDist === undefined || ancestorDist < existingDist) {
        nodeDistance.set(table.superClassName, ancestorDist);
      }
      edges.push({
        source: table.superClassName,
        target: current,
        type: "inheritance",
      });
      current = table.superClassName;
    } else {
      break;
    }
  }

  // 2. Walk DOWN children using BFS — go deeper than `depth` for gray boxes
  const maxChildDepth = depth + HIERARCHY_EXTRA_DEPTH;
  const queue: { name: string; level: number }[] = [
    { name: centerTable, level: 0 },
  ];

  while (queue.length > 0 && nodeDistance.size < MAX_NODES) {
    const item = queue.shift()!;
    const children = childrenMap.get(item.name) || [];

    for (const child of children) {
      if (nodeDistance.size >= MAX_NODES) break;

      const childLevel = item.level + 1;
      const existingDist = nodeDistance.get(child);
      if (existingDist === undefined || childLevel < existingDist) {
        nodeDistance.set(child, childLevel);
      }

      edges.push({
        source: item.name,
        target: child,
        type: "inheritance",
      });

      if (childLevel < maxChildDepth) {
        queue.push({ name: child, level: childLevel });
      }
    }
  }

  // 3. Optionally include reference targets (only from the center table to keep it clean)
  const referenceTargetNames = new Set<string>();

  if (includeRefs && nodeDistance.size < MAX_NODES) {
    const refColumns = await prisma.snapshotColumn.findMany({
      where: {
        table: {
          snapshotId,
          name: centerTable,
        },
        referenceTable: { not: null },
      },
      select: {
        element: true,
        referenceTable: true,
        definedOnTable: true,
        table: { select: { name: true } },
      },
    });

    // Group references by resolved target table name
    // so we get one edge per target with a combined label
    const refsByTarget = new Map<
      string,
      { element: string; definedOnTable: string }[]
    >();

    for (const col of refColumns) {
      if (!col.referenceTable) continue;

      // Resolve referenceTable — may be stored as table name OR display label
      const refName = tableMap.has(col.referenceTable)
        ? col.referenceTable
        : labelToName.get(col.referenceTable) || null;

      if (!refName) continue;
      // Skip references to self or tables already in hierarchy
      if (refName === centerTable) continue;

      const existing = refsByTarget.get(refName) || [];
      existing.push({
        element: col.element,
        definedOnTable: col.definedOnTable || centerTable,
      });
      refsByTarget.set(refName, existing);
    }

    // Create one edge per unique target, label with column count if multiple
    for (const [refName, fields] of refsByTarget) {
      const label =
        fields.length <= 2
          ? fields.map((f) => f.element).join(", ")
          : `${fields[0].element} +${fields.length - 1}`;

      edges.push({
        source: centerTable,
        target: refName,
        type: "reference",
        label,
        fields,
      });

      // Add the referenced table as a node if not already included
      if (!nodeDistance.has(refName) && tableMap.has(refName)) {
        nodeDistance.set(refName, depth + 1);
        referenceTargetNames.add(refName);
      }
    }
  }

  // Build response
  const truncated = nodeDistance.size >= MAX_NODES;
  const nodes: GraphNode[] = [];

  const includedNames = new Set(nodeDistance.keys());

  for (const [name, distance] of nodeDistance) {
    const t = tableMap.get(name);
    if (!t) continue;

    const totalChildren = (childrenMap.get(name) || []).length;
    const includedChildren = (childrenMap.get(name) || []).filter((c) =>
      includedNames.has(c)
    ).length;

    nodes.push({
      name: t.name,
      label: t.label,
      scopeName: t.scopeName,
      scopeLabel: t.scopeLabel,
      ownColumnCount: t.ownColumnCount,
      totalColumnCount: t.totalColumnCount,
      childTableCount: t.childTableCount,
      isExtendable: t.isExtendable,
      isCenter: t.name === centerTable,
      isTruncated: includedChildren < totalChildren,
      isDetailed: distance <= depth,
      isReferenceTarget: referenceTargetNames.has(t.name),
    });
  }

  // Filter edges to only include those where both endpoints are in our node set
  const validEdges = edges.filter(
    (e) => includedNames.has(e.source) && includedNames.has(e.target)
  );

  // Deduplicate edges
  const edgeSet = new Set<string>();
  const uniqueEdges = validEdges.filter((e) => {
    const key = `${e.source}-${e.target}-${e.type}-${e.label || ""}`;
    if (edgeSet.has(key)) return false;
    edgeSet.add(key);
    return true;
  });

  const response: GraphResponse = {
    nodes,
    edges: uniqueEdges,
    truncated,
  };

  return NextResponse.json(response);
}
