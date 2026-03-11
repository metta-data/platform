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
    columns: dedupedColumns,
    inheritanceChain,
    childTables: childTables.map((t) => t.name),
  });
}
