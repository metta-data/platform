import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export async function GET() {
  const levels = await prisma.classificationLevel.findMany({
    orderBy: { severity: "asc" },
    include: {
      _count: { select: { entries: true } },
    },
  });

  return NextResponse.json(
    levels.map((l) => ({
      id: l.id,
      name: l.name,
      description: l.description,
      color: l.color,
      severity: l.severity,
      isSystem: l.isSystem,
      entryCount: l._count.entries,
      createdAt: l.createdAt,
    }))
  );
}

export async function POST(request: Request) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { name, description, color, severity } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  try {
    const level = await prisma.classificationLevel.create({
      data: {
        name: name.trim(),
        description: description || null,
        color: color || "#6B7280",
        severity: severity ?? 0,
        isSystem: false,
      },
    });
    return NextResponse.json(level, { status: 201 });
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
