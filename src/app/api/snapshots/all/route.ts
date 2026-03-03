import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const snapshots = await prisma.schemaSnapshot.findMany({
    select: {
      id: true,
      label: true,
      version: true,
      description: true,
      status: true,
      sourceType: true,
      tableCount: true,
      columnCount: true,
      isBaseline: true,
      createdAt: true,
      errorMessage: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(snapshots);
}
