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

  // Build inheritance chain (walk up superClassName)
  const inheritanceChain: string[] = [];
  let current = table.superClassName;
  while (current) {
    inheritanceChain.push(current);
    const parent = await prisma.snapshotTable.findUnique({
      where: { snapshotId_name: { snapshotId, name: current } },
      select: { superClassName: true },
    });
    current = parent?.superClassName ?? null;
  }

  // Also fetch inherited columns from ancestor tables
  const inheritedColumns = [];
  for (const ancestor of inheritanceChain) {
    const ancestorTable = await prisma.snapshotTable.findUnique({
      where: { snapshotId_name: { snapshotId, name: ancestor } },
      include: {
        columns: {
          where: { definedOnTable: ancestor },
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
    columns: [...table.columns, ...inheritedColumns],
    inheritanceChain,
    childTables: childTables.map((t) => t.name),
  });
}
