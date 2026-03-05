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
    where.OR = [
      { tableName: { contains: search, mode: "insensitive" } },
      { element: { contains: search, mode: "insensitive" } },
      { label: { contains: search, mode: "insensitive" } },
      { definition: { contains: search, mode: "insensitive" } },
    ];
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

  const [entries, total] = await Promise.all([
    prisma.catalogEntry.findMany({
      where,
      include: {
        steward: {
          select: { id: true, username: true, displayName: true },
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
