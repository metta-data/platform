import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireStewardOrAdmin } from "@/lib/auth";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ tableName: string; element: string }> }
) {
  const session = await requireStewardOrAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { tableName, element } = await params;
  const decodedTable = decodeURIComponent(tableName);
  const decodedElement = decodeURIComponent(element);

  const entry = await prisma.catalogEntry.findUnique({
    where: {
      tableName_element: {
        tableName: decodedTable,
        element: decodedElement,
      },
    },
  });

  if (!entry) {
    return NextResponse.json(
      { error: "Catalog entry not found" },
      { status: 404 }
    );
  }

  const userId =
    typeof session === "object" && "user" in session
      ? session.user?.userId
      : undefined;

  const body = await request.json();
  const { addClassificationIds, removeClassificationIds, justification } = body;

  // Remove classifications
  if (removeClassificationIds?.length) {
    await prisma.catalogEntryClassification.deleteMany({
      where: {
        catalogEntryId: entry.id,
        classificationLevelId: { in: removeClassificationIds },
      },
    });

    // Audit removals
    const removedLevels = await prisma.classificationLevel.findMany({
      where: { id: { in: removeClassificationIds } },
      select: { name: true },
    });
    if (removedLevels.length > 0) {
      await prisma.catalogFieldAudit.create({
        data: {
          catalogEntryId: entry.id,
          fieldName: "classification",
          oldValue: removedLevels.map((l) => l.name).join(", "),
          newValue: null,
          comment: "Removed classification(s)",
          userId: userId || null,
        },
      });
    }
  }

  // Add classifications
  if (addClassificationIds?.length) {
    const addedLevels = await prisma.classificationLevel.findMany({
      where: { id: { in: addClassificationIds } },
      select: { id: true, name: true },
    });

    for (const level of addedLevels) {
      await prisma.catalogEntryClassification.upsert({
        where: {
          catalogEntryId_classificationLevelId: {
            catalogEntryId: entry.id,
            classificationLevelId: level.id,
          },
        },
        update: {},
        create: {
          catalogEntryId: entry.id,
          classificationLevelId: level.id,
          classifiedById: userId || "",
          justification: justification || null,
        },
      });
    }

    // Audit additions
    if (addedLevels.length > 0) {
      await prisma.catalogFieldAudit.create({
        data: {
          catalogEntryId: entry.id,
          fieldName: "classification",
          oldValue: null,
          newValue: addedLevels.map((l) => l.name).join(", "),
          comment: justification || "Added classification(s)",
          userId: userId || null,
        },
      });
    }
  }

  // Return updated classifications
  const updated = await prisma.catalogEntryClassification.findMany({
    where: { catalogEntryId: entry.id },
    include: {
      classificationLevel: {
        select: { id: true, name: true, color: true, severity: true },
      },
      classifiedBy: {
        select: { id: true, username: true, displayName: true },
      },
    },
  });

  return NextResponse.json(updated);
}
