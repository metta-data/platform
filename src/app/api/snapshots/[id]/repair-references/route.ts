import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ServiceNowClient } from "@/lib/servicenow/client";
import { requireAdmin } from "@/lib/auth";
import { decrypt } from "@/lib/crypto";
import { buildReferenceLookups, resolveReferenceTable } from "@/lib/servicenow/resolve-references";

/**
 * POST /api/snapshots/[id]/repair-references
 *
 * Re-fetches reference field data from ServiceNow and updates
 * referenceTable for existing columns in-place. No new snapshot
 * is created — this is a targeted repair for snapshots where
 * referenceTable was not resolved correctly during ingestion.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: snapshotId } = await params;

  // Load the snapshot and its source instance
  const snapshot = await prisma.schemaSnapshot.findUnique({
    where: { id: snapshotId },
    include: { instance: true },
  });

  if (!snapshot) {
    return NextResponse.json({ error: "Snapshot not found" }, { status: 404 });
  }

  if (!snapshot.instance) {
    return NextResponse.json(
      { error: "Snapshot has no linked ServiceNow instance" },
      { status: 400 }
    );
  }

  const instance = snapshot.instance;

  // Build table lookup maps from the existing snapshot data
  const allTables = await prisma.snapshotTable.findMany({
    where: { snapshotId },
    select: { name: true, label: true, sysId: true },
  });

  const lookups = buildReferenceLookups(allTables);

  // Fetch reference field data from ServiceNow (lightweight — only reference columns)
  const client = new ServiceNowClient({
    url: instance.url,
    username: instance.username,
    password: decrypt(instance.encryptedPassword),
  });

  const refFields = await client.fetchReferenceFields();

  // Resolve each reference to a table name using the shared 4-step chain
  const refMap = new Map<string, string>();
  let resolvedByName = 0;
  let resolvedBySysId = 0;
  let resolvedByLabel = 0;
  let resolvedByLabelCI = 0;
  let unresolvedCount = 0;
  const unresolvedSamples: { tableName: string; element: string; refSysId: string; refLabel: string }[] = [];

  for (const ref of refFields) {
    const result = resolveReferenceTable(ref.refSysId, ref.refLabel, lookups);

    if (result.resolvedName) {
      refMap.set(`${ref.tableName}:${ref.element}`, result.resolvedName);
      if (result.resolvedBy === "name") resolvedByName++;
      else if (result.resolvedBy === "sysId") resolvedBySysId++;
      else if (result.resolvedBy === "label") resolvedByLabel++;
      else resolvedByLabelCI++;
    } else {
      unresolvedCount++;
      if (unresolvedSamples.length < 5) {
        unresolvedSamples.push(ref);
      }
    }
  }

  console.log(`[repair-references] Fetched ${refFields.length} reference fields from ServiceNow`);
  console.log(`[repair-references]   tableNameSet size: ${lookups.tableNameSet.size}`);
  console.log(`[repair-references]   sysIdToName map size: ${lookups.sysIdToName.size}`);
  console.log(`[repair-references]   labelToName map size: ${lookups.labelToName.size}`);
  console.log(`[repair-references]   Resolved by name: ${resolvedByName}`);
  console.log(`[repair-references]   Resolved by sys_id: ${resolvedBySysId}`);
  console.log(`[repair-references]   Resolved by label: ${resolvedByLabel}`);
  console.log(`[repair-references]   Resolved by label (CI): ${resolvedByLabelCI}`);
  console.log(`[repair-references]   Unresolved: ${unresolvedCount}`);
  if (unresolvedSamples.length > 0) {
    console.log(`[repair-references]   Unresolved samples:`, JSON.stringify(unresolvedSamples, null, 2));
  }

  // Update ALL reference columns (not just null) to correct label-collision misresolutions
  const columnsToUpdate = await prisma.snapshotColumn.findMany({
    where: {
      table: { snapshotId },
      internalType: "Reference",
    },
    select: { id: true, element: true, definedOnTable: true, referenceTable: true },
  });

  let updatedCount = 0;
  let correctedCount = 0;
  const updateBatch = 500;

  for (let i = 0; i < columnsToUpdate.length; i += updateBatch) {
    const batch = columnsToUpdate.slice(i, i + updateBatch);
    const updates = batch
      .map((col) => {
        const resolved = refMap.get(`${col.definedOnTable}:${col.element}`);
        if (!resolved) return null;
        // Skip if already correct
        if (col.referenceTable === resolved) return null;
        const wasCorrected = col.referenceTable !== null && col.referenceTable !== resolved;
        return { id: col.id, referenceTable: resolved, wasCorrected };
      })
      .filter(Boolean) as { id: string; referenceTable: string; wasCorrected: boolean }[];

    await Promise.all(
      updates.map((u) =>
        prisma.snapshotColumn.update({
          where: { id: u.id },
          data: { referenceTable: u.referenceTable },
        })
      )
    );
    updatedCount += updates.length;
    correctedCount += updates.filter((u) => u.wasCorrected).length;
  }

  const stats = {
    totalRefFieldsFetched: refFields.length,
    resolvedByName,
    resolvedBySysId,
    resolvedByLabel,
    resolvedByLabelCI,
    unresolved: unresolvedCount,
    columnsChecked: columnsToUpdate.length,
    columnsUpdated: updatedCount,
    columnsCorrected: correctedCount,
  };

  console.log(`[repair-references] Updated ${updatedCount} columns (${correctedCount} corrected from wrong value), checked ${columnsToUpdate.length} total`);

  return NextResponse.json({ status: "completed", ...stats });
}
