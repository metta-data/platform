import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const [
    totalEntries,
    definedCount,
    stewardedCount,
    tableNames,
    validatedCount,
    draftWithDefinitionCount,
    classifiedCount,
    deprecatedCount,
  ] = await Promise.all([
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
    prisma.catalogEntry.count({
      where: { validationStatus: "VALIDATED" },
    }),
    prisma.catalogEntry.count({
      where: {
        validationStatus: "DRAFT",
        definition: { not: null },
      },
    }),
    prisma.catalogEntry.count({
      where: { classifications: { some: {} } },
    }),
    prisma.catalogEntry.count({
      where: { isDeprecated: true },
    }),
  ]);

  return NextResponse.json({
    totalEntries,
    definedCount,
    undefinedCount: totalEntries - definedCount,
    stewardedCount,
    tableCount: tableNames.length,
    validatedCount,
    draftWithDefinitionCount,
    classifiedCount,
    deprecatedCount,
  });
}
