import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApproved } from "@/lib/auth";

export async function GET() {
  const snapshots = await prisma.schemaSnapshot.findMany({
    where: { status: "COMPLETED" },
    select: {
      id: true,
      label: true,
      version: true,
      description: true,
      status: true,
      tableCount: true,
      columnCount: true,
      isBaseline: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(snapshots);
}

export async function POST(request: Request) {
  if (!(await requireApproved())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json();
  const { label, version, description, instanceId, isBaseline } = body;

  if (!label) {
    return NextResponse.json({ error: "Label is required" }, { status: 400 });
  }

  const snapshot = await prisma.schemaSnapshot.create({
    data: {
      label,
      version: version || null,
      description: description || null,
      instanceId: instanceId || null,
      isBaseline: isBaseline ?? false,
    },
  });

  return NextResponse.json(snapshot, { status: 201 });
}
