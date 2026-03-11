import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const { name, description, color, severity } = body;

  const existing = await prisma.classificationLevel.findUnique({
    where: { id },
  });
  if (!existing) {
    return NextResponse.json(
      { error: "Classification level not found" },
      { status: 404 }
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: Record<string, any> = {};
  if (name !== undefined) data.name = name.trim();
  if (description !== undefined) data.description = description || null;
  if (color !== undefined) data.color = color;
  if (severity !== undefined) data.severity = severity;

  try {
    const updated = await prisma.classificationLevel.update({
      where: { id },
      data,
    });
    return NextResponse.json(updated);
  } catch (err) {
    if (
      err instanceof Error &&
      err.message.includes("Unique constraint")
    ) {
      return NextResponse.json(
        { error: "A classification with that name already exists" },
        { status: 409 }
      );
    }
    throw err;
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const existing = await prisma.classificationLevel.findUnique({
    where: { id },
  });
  if (!existing) {
    return NextResponse.json(
      { error: "Classification level not found" },
      { status: 404 }
    );
  }

  if (existing.isSystem) {
    return NextResponse.json(
      { error: "System classification levels cannot be deleted" },
      { status: 403 }
    );
  }

  await prisma.classificationLevel.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
