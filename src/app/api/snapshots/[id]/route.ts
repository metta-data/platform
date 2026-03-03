import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const snapshot = await prisma.schemaSnapshot.findUnique({
    where: { id },
    include: {
      instance: { select: { name: true, url: true } },
    },
  });

  if (!snapshot) {
    return NextResponse.json({ error: "Snapshot not found" }, { status: 404 });
  }

  return NextResponse.json(snapshot);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  await prisma.schemaSnapshot.delete({
    where: { id },
  });

  return NextResponse.json({ success: true });
}
