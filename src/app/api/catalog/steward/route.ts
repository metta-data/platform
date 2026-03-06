import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireStewardOrAdmin } from "@/lib/auth";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Build a Prisma where clause from filter parameters.
 * Reuses the same filter logic as GET /api/catalog.
 */
function buildFilterWhere(filters: {
  search?: string;
  table?: string;
  type?: string;
  defined?: string;
  validated?: string;
  source?: string;
}): Prisma.CatalogEntryWhereInput {
  const where: Prisma.CatalogEntryWhereInput = {};

  if (filters.search) {
    where.OR = [
      { tableName: { contains: filters.search, mode: "insensitive" } },
      { element: { contains: filters.search, mode: "insensitive" } },
      { label: { contains: filters.search, mode: "insensitive" } },
      { definition: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  if (filters.table) {
    where.tableName = filters.table;
  }

  if (filters.type) {
    where.internalType = filters.type;
  }

  if (filters.defined === "true") {
    where.definition = { not: null };
  } else if (filters.defined === "false") {
    where.definition = null;
  }

  if (filters.validated === "true") {
    where.validationStatus = "VALIDATED";
  } else if (filters.validated === "false") {
    where.validationStatus = "DRAFT";
  }

  if (filters.source) {
    where.definitionSource =
      filters.source as Prisma.EnumDefinitionSourceNullableFilter["equals"];
  }

  return where;
}

export async function PATCH(request: Request) {
  const session = await requireStewardOrAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { entryIds, filters, stewardId } = body as {
    entryIds?: string[];
    filters?: {
      search?: string;
      table?: string;
      type?: string;
      defined?: string;
      validated?: string;
      source?: string;
    };
    stewardId: string | null;
  };

  // Either entryIds (page-level selection) or filters (bulk all matching)
  let where: Prisma.CatalogEntryWhereInput;

  if (entryIds && Array.isArray(entryIds) && entryIds.length > 0) {
    where = { id: { in: entryIds } };
  } else if (filters) {
    where = buildFilterWhere(filters);
  } else {
    return NextResponse.json(
      { error: "Either entryIds or filters are required" },
      { status: 400 }
    );
  }

  const userId =
    typeof session === "object" && "user" in session
      ? session.user?.userId
      : undefined;

  // Resolve steward names for audit trail
  const [oldStewards, newSteward] = await Promise.all([
    // We only need old steward names for entries that are actually changing
    prisma.catalogEntry.findMany({
      where,
      select: {
        id: true,
        stewardId: true,
        steward: { select: { username: true, displayName: true } },
      },
    }),
    stewardId
      ? prisma.user.findUnique({
          where: { id: stewardId },
          select: { username: true, displayName: true },
        })
      : null,
  ]);

  const newStewardName = newSteward
    ? newSteward.displayName || newSteward.username
    : null;

  // Filter to only entries that are actually changing
  const changing = oldStewards.filter((e) => e.stewardId !== stewardId);

  if (changing.length === 0) {
    return NextResponse.json({ updated: 0 });
  }

  // Update steward and create audit records in batches
  const BATCH_SIZE = 500;
  let updated = 0;

  for (let i = 0; i < changing.length; i += BATCH_SIZE) {
    const batch = changing.slice(i, i + BATCH_SIZE);
    const batchIds = batch.map((e) => e.id);

    await prisma.$transaction(
      async (tx) => {
        await tx.catalogEntry.updateMany({
          where: { id: { in: batchIds } },
          data: { stewardId: stewardId || null },
        });

        await tx.catalogFieldAudit.createMany({
          data: batch.map((entry) => ({
            catalogEntryId: entry.id,
            fieldName: "steward",
            oldValue: entry.steward
              ? entry.steward.displayName || entry.steward.username
              : null,
            newValue: newStewardName,
            comment: null,
            userId: userId || null,
          })),
        });
      },
      { timeout: 30000 }
    );

    updated += batch.length;
  }

  return NextResponse.json({ updated });
}
