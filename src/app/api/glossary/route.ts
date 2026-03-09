import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApproved, requireStewardOrAdmin } from "@/lib/auth";

/** GET /api/glossary — List glossary terms with optional search & category filter */
export async function GET(request: NextRequest) {
  const session = await requireApproved();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const search = searchParams.get("search")?.trim() || "";
  const category = searchParams.get("category")?.trim() || "";

  const where: Record<string, unknown> = {};

  if (search) {
    where.OR = [
      { term: { contains: search, mode: "insensitive" } },
      { definition: { contains: search, mode: "insensitive" } },
    ];
  }

  if (category) {
    where.category = category;
  }

  const terms = await prisma.glossaryTerm.findMany({
    where,
    include: {
      createdBy: { select: { id: true, displayName: true, username: true } },
      updatedBy: { select: { id: true, displayName: true, username: true } },
    },
    orderBy: { term: "asc" },
  });

  return NextResponse.json(terms);
}

/** POST /api/glossary — Create a new glossary term (steward or admin) */
export async function POST(request: Request) {
  const session = await requireStewardOrAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { term, definition, category, relatedTables, csdmDomainId } = body;

  if (!term || typeof term !== "string" || term.trim().length === 0) {
    return NextResponse.json(
      { error: "Term is required" },
      { status: 400 }
    );
  }

  if (
    !definition ||
    typeof definition !== "string" ||
    definition.trim().length === 0
  ) {
    return NextResponse.json(
      { error: "Definition is required" },
      { status: 400 }
    );
  }

  // Check for duplicate term
  const existing = await prisma.glossaryTerm.findUnique({
    where: { term: term.trim() },
  });
  if (existing) {
    return NextResponse.json(
      { error: "A term with this name already exists" },
      { status: 409 }
    );
  }

  // Resolve the user id (when auth is enabled)
  let userId: string | null = null;
  if (typeof session === "object" && session?.user?.userId) {
    userId = session.user.userId as string;
  }

  const glossaryTerm = await prisma.glossaryTerm.create({
    data: {
      term: term.trim(),
      definition: definition.trim(),
      category: category?.trim() || null,
      relatedTables: Array.isArray(relatedTables) ? relatedTables : [],
      csdmDomainId: csdmDomainId?.trim() || null,
      createdById: userId,
      updatedById: userId,
    },
  });

  return NextResponse.json(glossaryTerm, { status: 201 });
}
