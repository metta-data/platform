import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tableName: string }> }
) {
  const { tableName } = await params;
  const { searchParams } = new URL(request.url);
  const snapshotId = searchParams.get("snapshotId");

  if (!snapshotId) {
    return NextResponse.json(
      { error: "snapshotId is required" },
      { status: 400 }
    );
  }

  const table = await prisma.snapshotTable.findUnique({
    where: {
      snapshotId_name: { snapshotId, name: tableName },
    },
    include: {
      columns: {
        orderBy: [{ definedOnTable: "asc" }, { element: "asc" }],
        select: {
          element: true,
          label: true,
          definedOnTable: true,
          internalType: true,
          referenceTable: true,
          maxLength: true,
          isMandatory: true,
          isReadOnly: true,
          isActive: true,
          isDisplay: true,
          isPrimary: true,
          defaultValue: true,
        },
      },
    },
  });

  if (!table) {
    return NextResponse.json({ error: "Table not found" }, { status: 404 });
  }

  // Build inheritance chain (walk up superClassName) with labels
  const inheritanceChain: { name: string; label: string }[] = [];
  let current = table.superClassName;
  while (current) {
    const parent = await prisma.snapshotTable.findUnique({
      where: { snapshotId_name: { snapshotId, name: current } },
      select: { label: true, superClassName: true },
    });
    inheritanceChain.push({ name: current, label: parent?.label || current });
    current = parent?.superClassName ?? null;
  }

  // Also fetch inherited columns from ancestor tables
  const inheritedColumns = [];
  for (const ancestor of inheritanceChain) {
    const ancestorTable = await prisma.snapshotTable.findUnique({
      where: { snapshotId_name: { snapshotId, name: ancestor.name } },
      include: {
        columns: {
          where: { definedOnTable: ancestor.name },
          orderBy: { element: "asc" },
          select: {
            element: true,
            label: true,
            definedOnTable: true,
            internalType: true,
            referenceTable: true,
            maxLength: true,
            isMandatory: true,
            isReadOnly: true,
            isActive: true,
            isDisplay: true,
            isPrimary: true,
            defaultValue: true,
          },
        },
      },
    });
    if (ancestorTable) {
      inheritedColumns.push(...ancestorTable.columns);
    }
  }

  // Get child tables
  const childTables = await prisma.snapshotTable.findMany({
    where: { snapshotId, superClassName: tableName },
    select: { name: true },
    orderBy: { name: "asc" },
  });

  // Deduplicate: table.columns already includes inherited columns (with correct
  // definedOnTable). The ancestor fetch is a safety net for incomplete data.
  // Keep the first occurrence of each element name to avoid double-rendering.
  const seen = new Set<string>();
  const dedupedColumns = [...table.columns, ...inheritedColumns].filter(
    (col) => {
      if (seen.has(col.element)) return false;
      seen.add(col.element);
      return true;
    }
  );

  // Normalize referenceTable values — some snapshots may have stale data
  // (e.g. "user" instead of "sys_user") from older ingestions where the
  // reference resolution chain didn't resolve correctly.  Validate each
  // column's referenceTable against known table names and fall back to
  // label-based resolution when it doesn't match.
  const hasRefs = dedupedColumns.some((c) => c.referenceTable);
  let normalizedColumns = dedupedColumns;

  if (hasRefs) {
    const allTables = await prisma.snapshotTable.findMany({
      where: { snapshotId },
      select: { name: true, label: true },
    });
    const tableNameSet = new Set(allTables.map((t) => t.name));
    const labelToName = new Map<string, string>();
    for (const t of allTables) {
      if (!labelToName.has(t.label)) {
        labelToName.set(t.label, t.name);
      }
    }

    normalizedColumns = dedupedColumns.map((col) => {
      if (!col.referenceTable) return col;
      if (tableNameSet.has(col.referenceTable)) return col;
      // Try label-based resolution — the stored value may be a label or
      // lowercased label (e.g. "user" for label "User" → table "sys_user")
      const byLabel =
        labelToName.get(col.referenceTable) ??
        labelToName.get(
          col.referenceTable.charAt(0).toUpperCase() +
            col.referenceTable.slice(1)
        );
      if (byLabel) {
        return { ...col, referenceTable: byLabel };
      }
      return col;
    });
  }

  return NextResponse.json({
    name: table.name,
    label: table.label,
    superClassName: table.superClassName,
    scopeName: table.scopeName,
    scopeLabel: table.scopeLabel,
    isExtendable: table.isExtendable,
    numberPrefix: table.numberPrefix,
    ownColumnCount: table.ownColumnCount,
    totalColumnCount: table.totalColumnCount,
    childTableCount: table.childTableCount,
    columns: normalizedColumns,
    inheritanceChain,
    childTables: childTables.map((t) => t.name),
  });
}
