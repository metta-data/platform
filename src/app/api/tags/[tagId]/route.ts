import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireStewardOrAdmin, requireAdmin } from "@/lib/auth";

/** PATCH /api/tags/[tagId] — Update tag name/color (steward+) */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ tagId: string }> }
) {
  const session = await requireStewardOrAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { tagId } = await params;
  const body = await request.json();
  const { name, color } = body;

  const tag = await prisma.tag.findUnique({ where: { id: tagId } });
  if (!tag) {
    return NextResponse.json({ error: "Tag not found" }, { status: 404 });
  }

  // Check for name conflict if renaming
  if (name && name.trim() !== tag.name) {
    const existing = await prisma.tag.findUnique({
      where: { name: name.trim() },
    });
    if (existing) {
      return NextResponse.json(
        { error: "A tag with this name already exists" },
        { status: 409 }
      );
    }
  }

  const updated = await prisma.tag.update({
    where: { id: tagId },
    data: {
      ...(name ? { name: name.trim() } : {}),
      ...(color ? { color } : {}),
    },
  });

  return NextResponse.json(updated);
}

/** DELETE /api/tags/[tagId] — Delete a tag (admin only) */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ tagId: string }> }
) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { tagId } = await params;

  const tag = await prisma.tag.findUnique({ where: { id: tagId } });
  if (!tag) {
    return NextResponse.json({ error: "Tag not found" }, { status: 404 });
  }

  await prisma.tag.delete({ where: { id: tagId } });

  return NextResponse.json({ success: true });
}
