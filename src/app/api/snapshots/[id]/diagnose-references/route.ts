import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { buildReferenceLookups, validateReferenceTable } from "@/lib/servicenow/resolve-references";

/**
 * GET /api/snapshots/[id]/diagnose-references
 *
 * Read-only diagnostic: scans all referenceTable values in a snapshot
 * and reports which ones don't match any known table name (stale labels).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: snapshotId } = await params;

  const snapshot = await prisma.schemaSnapshot.findUnique({
    where: { id: snapshotId },
    select: { id: true, label: true },
  });

  if (!snapshot) {
    return NextResponse.json({ error: "Snapshot not found" }, { status: 404 });
  }

  // Build table lookup maps
  const allTables = await prisma.snapshotTable.findMany({
    where: { snapshotId },
    select: { name: true, label: true, sysId: true },
  });

  const lookups = buildReferenceLookups(allTables);

  // Query all columns with a referenceTable value
  const refColumns = await prisma.snapshotColumn.findMany({
    where: {
      table: { snapshotId },
      referenceTable: { not: null },
    },
    select: {
      element: true,
      referenceTable: true,
      definedOnTable: true,
      table: { select: { name: true } },
    },
  });

  const stale: {
    tableName: string;
    element: string;
    currentValue: string;
    suggestedValue: string | null;
    resolvedBy: string;
  }[] = [];

  const unresolvable: {
    tableName: string;
    element: string;
    currentValue: string;
  }[] = [];

  let validCount = 0;

  for (const col of refColumns) {
    const ref = col.referenceTable!;
    const result = validateReferenceTable(ref, lookups);

    if (result.valid) {
      validCount++;
    } else if (result.suggestedName) {
      stale.push({
        tableName: col.table.name,
        element: col.element,
        currentValue: ref,
        suggestedValue: result.suggestedName,
        resolvedBy: result.resolvedBy!,
      });
    } else {
      unresolvable.push({
        tableName: col.table.name,
        element: col.element,
        currentValue: ref,
      });
    }
  }

  return NextResponse.json({
    snapshotId: snapshot.id,
    snapshotLabel: snapshot.label,
    totalReferenceColumns: refColumns.length,
    valid: validCount,
    stale,
    unresolvable,
  });
}
