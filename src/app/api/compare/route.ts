import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { compareSnapshots } from "@/lib/schema/comparator";
import type { ColumnDetail } from "@/types";

export async function POST(request: Request) {
  const body = await request.json();
  const { baselineSnapshotId, targetSnapshotId } = body;

  if (!baselineSnapshotId || !targetSnapshotId) {
    return NextResponse.json(
      { error: "Both baselineSnapshotId and targetSnapshotId are required" },
      { status: 400 }
    );
  }

  const [baselineTables, targetTables] = await Promise.all([
    loadSnapshotData(baselineSnapshotId),
    loadSnapshotData(targetSnapshotId),
  ]);

  const result = compareSnapshots(baselineTables, targetTables);

  return NextResponse.json(result);
}

async function loadSnapshotData(snapshotId: string) {
  const tables = await prisma.snapshotTable.findMany({
    where: { snapshotId },
    include: {
      columns: {
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

  const tableMap = new Map<
    string,
    {
      name: string;
      label: string;
      columns: Map<string, ColumnDetail>;
    }
  >();

  for (const table of tables) {
    const columnMap = new Map<string, ColumnDetail>();
    for (const col of table.columns) {
      columnMap.set(col.element, col);
    }
    tableMap.set(table.name, {
      name: table.name,
      label: table.label,
      columns: columnMap,
    });
  }

  return { tables: tableMap };
}
