import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireStewardOrAdmin } from "@/lib/auth";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tableName: string; element: string }> }
) {
  const { tableName, element } = await params;
  const decodedTable = decodeURIComponent(tableName);
  const decodedElement = decodeURIComponent(element);

  const entry = await prisma.catalogEntry.findUnique({
    where: {
      tableName_element: {
        tableName: decodedTable,
        element: decodedElement,
      },
    },
    include: {
      steward: {
        select: { id: true, username: true, displayName: true },
      },
      sourceSnapshot: {
        select: { id: true, label: true, createdAt: true },
      },
      snapshots: {
        include: {
          snapshot: {
            select: { id: true, label: true, createdAt: true },
          },
        },
        orderBy: { linkedAt: "asc" },
      },
    },
  });

  if (!entry) {
    return NextResponse.json(
      { error: "Catalog entry not found" },
      { status: 404 }
    );
  }

  // Find inheriting tables from the most recent linked snapshot
  const latestSnapshot = entry.snapshots[entry.snapshots.length - 1];
  let inheritingTables: string[] = [];

  if (latestSnapshot) {
    // Find all tables in that snapshot that have this column
    // where definedOnTable = entry.tableName (the defining table)
    const columns = await prisma.snapshotColumn.findMany({
      where: {
        element: decodedElement,
        definedOnTable: decodedTable,
        table: { snapshotId: latestSnapshot.snapshotId },
      },
      select: {
        table: {
          select: { name: true },
        },
      },
      distinct: ["tableId"],
    });

    inheritingTables = columns
      .map((c) => c.table.name)
      .filter((name) => name !== decodedTable)
      .sort();
  }

  return NextResponse.json({
    entry: {
      id: entry.id,
      tableName: entry.tableName,
      element: entry.element,
      label: entry.label,
      internalType: entry.internalType,
      definition: entry.definition,
      steward: entry.steward,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
    },
    sourceSnapshot: entry.sourceSnapshot,
    linkedSnapshots: entry.snapshots.map((s) => ({
      id: s.snapshot.id,
      label: s.snapshot.label,
      linkedAt: s.linkedAt,
      createdAt: s.snapshot.createdAt,
    })),
    inheritingTables,
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ tableName: string; element: string }> }
) {
  const session = await requireStewardOrAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { tableName, element } = await params;
  const decodedTable = decodeURIComponent(tableName);
  const decodedElement = decodeURIComponent(element);

  const body = await request.json();
  const { definition, stewardId } = body;

  const entry = await prisma.catalogEntry.findUnique({
    where: {
      tableName_element: {
        tableName: decodedTable,
        element: decodedElement,
      },
    },
  });

  if (!entry) {
    return NextResponse.json(
      { error: "Catalog entry not found" },
      { status: 404 }
    );
  }

  const updateData: { definition?: string | null; stewardId?: string | null } = {};

  if (definition !== undefined) {
    updateData.definition = definition || null;
  }

  if (stewardId !== undefined) {
    updateData.stewardId = stewardId || null;
  }

  const updated = await prisma.catalogEntry.update({
    where: { id: entry.id },
    data: updateData,
    include: {
      steward: {
        select: { id: true, username: true, displayName: true },
      },
    },
  });

  return NextResponse.json(updated);
}
