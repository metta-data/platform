import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") || "";
  const table = searchParams.get("table") || "";
  const type = searchParams.get("type") || "";
  const steward = searchParams.get("steward") || "";
  const defined = searchParams.get("defined"); // "true" or "false"
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50", 10)));
  const skip = (page - 1) * limit;

  const where: Prisma.CatalogEntryWhereInput = {};

  if (search) {
    // Support "table.column" syntax for targeted search
    const dotIndex = search.indexOf(".");
    if (dotIndex > 0 && dotIndex < search.length - 1) {
      const tablePart = search.slice(0, dotIndex);
      const columnPart = search.slice(dotIndex + 1);
      where.AND = [
        { tableName: { contains: tablePart, mode: "insensitive" } },
        {
          OR: [
            { element: { contains: columnPart, mode: "insensitive" } },
            { label: { contains: columnPart, mode: "insensitive" } },
          ],
        },
      ];
    } else {
      where.OR = [
        { tableName: { contains: search, mode: "insensitive" } },
        { element: { contains: search, mode: "insensitive" } },
        { label: { contains: search, mode: "insensitive" } },
        { definition: { contains: search, mode: "insensitive" } },
      ];
    }
  }

  if (table) {
    where.tableName = table;
  }

  if (type) {
    where.internalType = type;
  }

  if (steward) {
    where.stewardId = steward;
  }

  if (defined === "true") {
    where.definition = { not: null };
  } else if (defined === "false") {
    where.definition = null;
  }

  const validated = searchParams.get("validated");
  if (validated === "true") {
    where.validationStatus = "VALIDATED";
  } else if (validated === "false") {
    where.validationStatus = "DRAFT";
  }

  const source = searchParams.get("source");
  if (source) {
    where.definitionSource = source as Prisma.EnumDefinitionSourceNullableFilter["equals"];
  }

  // Tag filter: comma-separated tag IDs (entries must have ALL specified tags)
  const tags = searchParams.get("tags");
  if (tags) {
    const tagIds = tags.split(",").filter(Boolean);
    if (tagIds.length > 0) {
      where.tags = {
        some: { tagId: { in: tagIds } },
      };
    }
  }

  const [entries, total] = await Promise.all([
    prisma.catalogEntry.findMany({
      where,
      include: {
        steward: {
          select: { id: true, username: true, displayName: true },
        },
        tags: {
          include: {
            tag: { select: { id: true, name: true, color: true, tagType: true } },
          },
        },
      },
      orderBy: [{ tableName: "asc" }, { element: "asc" }],
      skip,
      take: limit,
    }),
    prisma.catalogEntry.count({ where }),
  ]);

  return NextResponse.json({
    entries,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}
