import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireStewardOrAdmin } from "@/lib/auth";
import { auditFieldChanges } from "@/lib/catalog/audit";
import { syncAutoTags } from "@/lib/catalog/auto-tags";

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
      validatedBy: {
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
      tags: {
        include: {
          tag: { select: { id: true, name: true, color: true, tagType: true } },
        },
      },
      classifications: {
        include: {
          classificationLevel: true,
          classifiedBy: { select: { id: true, username: true, displayName: true } },
        },
      },
      deprecatedBy: {
        select: { id: true, username: true, displayName: true },
      },
      supersededBy: {
        select: { id: true, tableName: true, element: true, label: true },
      },
      supersedes: {
        select: { id: true, tableName: true, element: true, label: true },
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

  const auditRecords = await prisma.catalogFieldAudit.findMany({
    where: { catalogEntryId: entry.id },
    include: {
      user: { select: { id: true, username: true, displayName: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const auditHistory = auditRecords.map((a) => ({
    id: a.id,
    fieldName: a.fieldName,
    oldValue: a.oldValue,
    newValue: a.newValue,
    comment: a.comment,
    user: a.user,
    createdAt: a.createdAt,
  }));

  return NextResponse.json({
    entry: {
      id: entry.id,
      tableName: entry.tableName,
      element: entry.element,
      label: entry.label,
      internalType: entry.internalType,
      definition: entry.definition,
      definitionSource: entry.definitionSource,
      definitionSourceDetail: entry.definitionSourceDetail,
      citationUrl: entry.citationUrl,
      validationStatus: entry.validationStatus,
      validatedAt: entry.validatedAt,
      validatedBy: entry.validatedBy,
      steward: entry.steward,
      tags: entry.tags.map((t) => t.tag),
      classifications: entry.classifications.map((c) => ({
        id: c.id,
        classificationLevel: c.classificationLevel,
        classifiedBy: c.classifiedBy,
        justification: c.justification,
        classifiedAt: c.classifiedAt,
      })),
      isDeprecated: entry.isDeprecated,
      deprecatedAt: entry.deprecatedAt,
      deprecatedBy: entry.deprecatedBy,
      deprecationNote: entry.deprecationNote,
      supersededBy: entry.supersededBy,
      supersedes: entry.supersedes,
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
    auditHistory,
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
  const { definition, stewardId, validationStatus, definitionSource, definitionSourceDetail, citationUrl, aiConfidence, isDeprecated, deprecationNote, supersededById } = body;

  const entry = await prisma.catalogEntry.findUnique({
    where: {
      tableName_element: {
        tableName: decodedTable,
        element: decodedElement,
      },
    },
    include: {
      steward: { select: { username: true, displayName: true } },
      validatedBy: { select: { username: true, displayName: true } },
    },
  });

  if (!entry) {
    return NextResponse.json(
      { error: "Catalog entry not found" },
      { status: 404 }
    );
  }

  const userId =
    typeof session === "object" && "user" in session
      ? session.user?.userId
      : undefined;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateData: Record<string, any> = {};

  if (definition !== undefined) {
    updateData.definition = definition || null;
    // Use provided source (e.g., AI_GENERATED) or default to MANUAL
    updateData.definitionSource = definitionSource || "MANUAL";
    updateData.definitionSourceDetail = definitionSourceDetail || null;
    updateData.citationUrl = citationUrl || null;
    // Reset validation when definition changes
    updateData.validationStatus = "DRAFT";
    updateData.validatedAt = null;
    updateData.validatedById = null;
  }

  if (stewardId !== undefined) {
    updateData.stewardId = stewardId || null;
  }

  // Handle deprecation
  if (isDeprecated !== undefined) {
    updateData.isDeprecated = isDeprecated;
    if (isDeprecated) {
      updateData.deprecatedAt = new Date();
      updateData.deprecatedById = userId || null;
      if (deprecationNote !== undefined) {
        updateData.deprecationNote = deprecationNote || null;
      }
      if (supersededById !== undefined) {
        updateData.supersededById = supersededById || null;
      }
    } else {
      updateData.deprecatedAt = null;
      updateData.deprecatedById = null;
      updateData.deprecationNote = null;
      updateData.supersededById = null;
    }
  }

  // Allow explicit validation status override (e.g., single-entry validate)
  if (validationStatus !== undefined) {
    updateData.validationStatus = validationStatus;
    if (validationStatus === "VALIDATED") {
      updateData.validatedAt = new Date();
      updateData.validatedById = userId || null;
    } else {
      updateData.validatedAt = null;
      updateData.validatedById = null;
    }
  }

  // Resolve display names for ID fields
  const resolvedNames: Record<string, { old: string | null; new: string | null }> = {};

  if ("stewardId" in updateData && updateData.stewardId !== entry.stewardId) {
    const newSteward = updateData.stewardId
      ? await prisma.user.findUnique({
          where: { id: updateData.stewardId },
          select: { username: true, displayName: true },
        })
      : null;
    resolvedNames.stewardId = {
      old: entry.steward
        ? entry.steward.displayName || entry.steward.username
        : null,
      new: newSteward ? newSteward.displayName || newSteward.username : null,
    };
  }

  // Audit all field changes
  await auditFieldChanges(
    prisma,
    entry.id,
    entry,
    updateData,
    userId || null,
    body.comment || null,
    resolvedNames
  );

  const updated = await prisma.catalogEntry.update({
    where: { id: entry.id },
    data: updateData,
    include: {
      steward: {
        select: { id: true, username: true, displayName: true },
      },
      validatedBy: {
        select: { id: true, username: true, displayName: true },
      },
      tags: {
        include: {
          tag: { select: { id: true, name: true, color: true, tagType: true } },
        },
      },
    },
  });

  // Sync auto-tags when definition changes
  if (definition !== undefined) {
    await syncAutoTags(
      entry.id,
      updateData.definitionSource || null,
      aiConfidence || null
    );
  }

  return NextResponse.json({
    ...updated,
    tags: updated.tags.map((t) => t.tag),
  });
}
