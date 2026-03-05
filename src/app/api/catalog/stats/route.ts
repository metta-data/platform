import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const [totalEntries, definedCount, stewardedCount, tableNames] =
    await Promise.all([
      prisma.catalogEntry.count(),
      prisma.catalogEntry.count({
        where: { definition: { not: null } },
      }),
      prisma.catalogEntry.count({
        where: { stewardId: { not: null } },
      }),
      prisma.catalogEntry.findMany({
        select: { tableName: true },
        distinct: ["tableName"],
      }),
    ]);

  return NextResponse.json({
    totalEntries,
    definedCount,
    undefinedCount: totalEntries - definedCount,
    stewardedCount,
    tableCount: tableNames.length,
  });
}
