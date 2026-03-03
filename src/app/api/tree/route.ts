import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const snapshotId = searchParams.get("snapshotId");
  const scope = searchParams.get("scope");

  if (!snapshotId) {
    return NextResponse.json(
      { error: "snapshotId is required" },
      { status: 400 }
    );
  }

  const tables = await prisma.snapshotTable.findMany({
    where: {
      snapshotId,
      ...(scope ? { scopeName: scope } : {}),
    },
    select: {
      name: true,
      label: true,
      superClassName: true,
      scopeName: true,
      scopeLabel: true,
      ownColumnCount: true,
      totalColumnCount: true,
      childTableCount: true,
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(tables);
}
