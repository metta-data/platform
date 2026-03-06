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
      validationStatus: entry.validationStatus,
      validatedAt: entry.validatedAt,
      validatedBy: entry.validatedBy,
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
  const { definition, stewardId, validationStatus } = body;

  const entry = await prisma.catalogEntry.findUnique({
    where: {
      tableName_element: {
        tableName: decodedTable,
        element: decodedElement,
      },
    },
    include: {
      steward: { select: { username: true, displayName: true } },
    },
  });

  if (!entry) {
    return NextResponse.json(
      { error: "Catalog entry not found" },
      { status: 404 }
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateData: Record<string, any> = {};

  if (definition !== undefined) {
    updateData.definition = definition || null;
    // Manual edit: set source and reset validation
    updateData.definitionSource = "MANUAL";
    updateData.definitionSourceDetail = null;
    updateData.validationStatus = "DRAFT";
    updateData.validatedAt = null;
    updateData.validatedById = null;

    // Create audit record for the definition change
    const userId =
      typeof session === "object" && "user" in session
        ? session.user?.userId
        : undefined;
    await prisma.catalogFieldAudit.create({
      data: {
        catalogEntryId: entry.id,
        fieldName: "definition",
        oldValue: entry.definition,
        newValue: definition || null,
        comment: body.comment || null,
        userId: userId || null,
      },
    });
  }

  if (stewardId !== undefined && stewardId !== entry.stewardId) {
    updateData.stewardId = stewardId || null;

    // Resolve new steward name for audit
    const newSteward = stewardId
      ? await prisma.user.findUnique({
          where: { id: stewardId },
          select: { username: true, displayName: true },
        })
      : null;

    const userId =
      typeof session === "object" && "user" in session
        ? session.user?.userId
        : undefined;

    await prisma.catalogFieldAudit.create({
      data: {
        catalogEntryId: entry.id,
        fieldName: "steward",
        oldValue: entry.steward
          ? entry.steward.displayName || entry.steward.username
          : null,
        newValue: newSteward
          ? newSteward.displayName || newSteward.username
          : null,
        comment: body.comment || null,
        userId: userId || null,
      },
    });
  }

  // Allow explicit validation status override (e.g., single-entry validate)
  if (validationStatus !== undefined) {
    updateData.validationStatus = validationStatus;
    if (validationStatus === "VALIDATED") {
      updateData.validatedAt = new Date();
      const userId =
        typeof session === "object" && "user" in session
          ? session.user?.userId
          : undefined;
      updateData.validatedById = userId || null;
    } else {
      updateData.validatedAt = null;
      updateData.validatedById = null;
    }
  }

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
    },
  });

  return NextResponse.json(updated);
}
