import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireStewardOrAdmin } from "@/lib/auth";

/**
 * PATCH /api/catalog/tags — Add or remove tags from catalog entries.
 *
 * Body: { entryIds: string[], addTagIds?: string[], removeTagIds?: string[] }
 */
export async function PATCH(request: Request) {
  const session = await requireStewardOrAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { entryIds, addTagIds, removeTagIds } = body;

  if (!Array.isArray(entryIds) || entryIds.length === 0) {
    return NextResponse.json(
      { error: "entryIds array is required" },
      { status: 400 }
    );
  }

  // Remove tags
  if (Array.isArray(removeTagIds) && removeTagIds.length > 0) {
    await prisma.catalogEntryTag.deleteMany({
      where: {
        catalogEntryId: { in: entryIds },
        tagId: { in: removeTagIds },
      },
    });
  }

  // Add tags (skip duplicates via upsert)
  if (Array.isArray(addTagIds) && addTagIds.length > 0) {
    for (const entryId of entryIds) {
      for (const tagId of addTagIds) {
        await prisma.catalogEntryTag.upsert({
          where: {
            catalogEntryId_tagId: { catalogEntryId: entryId, tagId },
          },
          create: { catalogEntryId: entryId, tagId },
          update: {},
        });
      }
    }
  }

  return NextResponse.json({ success: true });
}
