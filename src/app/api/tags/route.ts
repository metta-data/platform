import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireStewardOrAdmin, requireApproved } from "@/lib/auth";

/** GET /api/tags — List all tags (any approved user) */
export async function GET() {
  const session = await requireApproved();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tags = await prisma.tag.findMany({
    include: {
      _count: { select: { entries: true } },
    },
    orderBy: [{ tagType: "asc" }, { name: "asc" }],
  });

  return NextResponse.json(
    tags.map((t) => ({
      id: t.id,
      name: t.name,
      color: t.color,
      tagType: t.tagType,
      entryCount: t._count.entries,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    }))
  );
}

/** POST /api/tags — Create a new tag (steward or admin) */
export async function POST(request: Request) {
  const session = await requireStewardOrAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { name, color } = body;

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json(
      { error: "Tag name is required" },
      { status: 400 }
    );
  }

  const existing = await prisma.tag.findUnique({
    where: { name: name.trim() },
  });
  if (existing) {
    return NextResponse.json(
      { error: "A tag with this name already exists" },
      { status: 409 }
    );
  }

  const tag = await prisma.tag.create({
    data: {
      name: name.trim(),
      color: color || "#6B7280",
      tagType: "USER",
    },
  });

  return NextResponse.json(tag, { status: 201 });
}
