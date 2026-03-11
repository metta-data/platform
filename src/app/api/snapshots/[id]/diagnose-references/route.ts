import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

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

  const tableNameSet = new Set(allTables.map((t) => t.name));
  const labelToName = new Map<string, string>();
  const lowerLabelToName = new Map<string, string>();
  for (const t of allTables) {
    if (!labelToName.has(t.label)) {
      labelToName.set(t.label, t.name);
    }
    const lower = t.label.toLowerCase();
    if (!lowerLabelToName.has(lower)) {
      lowerLabelToName.set(lower, t.name);
    }
  }

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
    if (tableNameSet.has(ref)) {
      validCount++;
      continue;
    }

    // Stale — try to suggest the correct value
    const byLabel = labelToName.get(ref) ?? null;
    const byLabelCI = !byLabel
      ? (lowerLabelToName.get(ref.toLowerCase()) ?? null)
      : null;
    const suggested = byLabel ?? byLabelCI ?? null;

    if (suggested) {
      stale.push({
        tableName: col.table.name,
        element: col.element,
        currentValue: ref,
        suggestedValue: suggested,
        resolvedBy: byLabel ? "label" : "labelCI",
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
