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

  const result = await prisma.catalogEntry.updateMany({
    where,
    data: { stewardId: stewardId || null },
  });

  return NextResponse.json({ updated: result.count });
}
