import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export async function POST(request: Request) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { snapshotId } = body;

  if (!snapshotId) {
    return NextResponse.json(
      { error: "snapshotId is required" },
      { status: 400 }
    );
  }

  // Verify snapshot exists and is completed
  const snapshot = await prisma.schemaSnapshot.findUnique({
    where: { id: snapshotId },
    select: { id: true, label: true, status: true },
  });

  if (!snapshot) {
    return NextResponse.json(
      { error: "Snapshot not found" },
      { status: 404 }
    );
  }

  if (snapshot.status !== "COMPLETED") {
    return NextResponse.json(
      { error: "Snapshot is not completed" },
      { status: 400 }
    );
  }

  // Get all columns from this snapshot, grouped by (definedOnTable, element)
  const columns = await prisma.snapshotColumn.findMany({
    where: {
      table: { snapshotId },
    },
    select: {
      element: true,
      label: true,
      definedOnTable: true,
      internalType: true,
    },
  });

  // Deduplicate by (definedOnTable, element) — take the first occurrence
  const uniqueFields = new Map<
    string,
    { tableName: string; element: string; label: string; internalType: string }
  >();

  for (const col of columns) {
    const key = `${col.definedOnTable}::${col.element}`;
    if (!uniqueFields.has(key)) {
      uniqueFields.set(key, {
        tableName: col.definedOnTable,
        element: col.element,
        label: col.label,
        internalType: col.internalType,
      });
    }
  }

  let created = 0;
  let updated = 0;

  // Process in batches to avoid overwhelming the DB
  const entries = Array.from(uniqueFields.values());

  for (const field of entries) {
    const existing = await prisma.catalogEntry.findUnique({
      where: {
        tableName_element: {
          tableName: field.tableName,
          element: field.element,
        },
      },
      select: { id: true },
    });

    if (existing) {
      // Update label and internalType, preserve definition and steward
      await prisma.catalogEntry.update({
        where: { id: existing.id },
        data: {
          label: field.label,
          internalType: field.internalType,
        },
      });
      updated++;

      // Link snapshot if not already linked
      await prisma.catalogEntrySnapshot.upsert({
        where: {
          catalogEntryId_snapshotId: {
            catalogEntryId: existing.id,
            snapshotId,
          },
        },
        create: {
          catalogEntryId: existing.id,
          snapshotId,
        },
        update: {},
      });
    } else {
      // Create new entry with this snapshot as the source
      const entry = await prisma.catalogEntry.create({
        data: {
          tableName: field.tableName,
          element: field.element,
          label: field.label,
          internalType: field.internalType,
          sourceSnapshotId: snapshotId,
        },
      });
      created++;

      // Link snapshot
      await prisma.catalogEntrySnapshot.create({
        data: {
          catalogEntryId: entry.id,
          snapshotId,
        },
      });
    }
  }

  return NextResponse.json({
    created,
    updated,
    total: entries.length,
    snapshotLabel: snapshot.label,
  });
}
