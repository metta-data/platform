import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireStewardOrAdmin, requireAdmin } from "@/lib/auth";

/** PATCH /api/glossary/:id — Update a glossary term (steward or admin) */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireStewardOrAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const existing = await prisma.glossaryTerm.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json(
      { error: "Glossary term not found" },
      { status: 404 }
    );
  }

  const body = await request.json();
  const { term, definition, category, relatedTables, csdmDomainId } = body;

  // Check for duplicate if term is being renamed
  if (term && term.trim() !== existing.term) {
    const duplicate = await prisma.glossaryTerm.findUnique({
      where: { term: term.trim() },
    });
    if (duplicate) {
      return NextResponse.json(
        { error: "A term with this name already exists" },
        { status: 409 }
      );
    }
  }

  let userId: string | null = null;
  if (typeof session === "object" && session?.user?.userId) {
    userId = session.user.userId as string;
  }

  const updated = await prisma.glossaryTerm.update({
    where: { id },
    data: {
      ...(term !== undefined && { term: term.trim() }),
      ...(definition !== undefined && { definition: definition.trim() }),
      ...(category !== undefined && { category: category?.trim() || null }),
      ...(relatedTables !== undefined && {
        relatedTables: Array.isArray(relatedTables) ? relatedTables : [],
      }),
      ...(csdmDomainId !== undefined && {
        csdmDomainId: csdmDomainId?.trim() || null,
      }),
      updatedById: userId,
    },
  });

  return NextResponse.json(updated);
}

/** DELETE /api/glossary/:id — Delete a glossary term (admin only) */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const existing = await prisma.glossaryTerm.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json(
      { error: "Glossary term not found" },
      { status: 404 }
    );
  }

  await prisma.glossaryTerm.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
