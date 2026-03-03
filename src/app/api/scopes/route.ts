import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const snapshotId = searchParams.get("snapshotId");

  if (!snapshotId) {
    return NextResponse.json(
      { error: "snapshotId is required" },
      { status: 400 }
    );
  }

  const scopes = await prisma.snapshotTable.groupBy({
    by: ["scopeName", "scopeLabel"],
    where: { snapshotId, scopeName: { not: null } },
    _count: { _all: true },
    orderBy: { scopeName: "asc" },
  });

  const result = scopes.map((s) => ({
    name: s.scopeName || "",
    label: s.scopeLabel || s.scopeName || "",
    count: s._count._all,
  }));

  return NextResponse.json(result);
}
