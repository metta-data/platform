/**
 * Auto-tag synchronization for catalog entries.
 *
 * Called after every definition save to ensure auto-tags reflect the current
 * definition source and AI confidence level.
 */

import type { DefinitionSource } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { AUTO_TAG_COLORS } from "./tag-colors";

/** AI confidence levels matching the evidence pipeline */
type AIConfidence = "high" | "medium" | "low" | "none";

/** All auto-tag names we manage */
const SOURCE_TAGS: Record<DefinitionSource, string> = {
  MANUAL: "Source: Manual",
  SYS_DOCUMENTATION: "Source: sys_documentation",
  EXCEL_UPLOAD: "Source: Excel",
  AI_GENERATED: "Source: AI",
};

const CONFIDENCE_TAGS: Record<string, string> = {
  high: "Cited",
  medium: "Partial",
  low: "Uncited",
  none: "Uncited",
};

const ALL_AUTO_TAG_NAMES = [
  ...Object.values(SOURCE_TAGS),
  ...new Set(Object.values(CONFIDENCE_TAGS)),
];

/**
 * Synchronize auto-tags for a catalog entry after a definition save.
 *
 * - Assigns one source tag based on `definitionSource`
 * - Assigns one confidence tag if source is AI_GENERATED
 * - Removes stale auto-tags that no longer apply
 */
export async function syncAutoTags(
  entryId: string,
  definitionSource: DefinitionSource | null,
  aiConfidence?: AIConfidence | null
): Promise<void> {
  // 1. Compute desired auto-tag names
  const desiredTags = new Set<string>();

  if (definitionSource) {
    const sourceTag = SOURCE_TAGS[definitionSource];
    if (sourceTag) desiredTags.add(sourceTag);

    // Confidence tags only apply to AI-generated definitions
    if (definitionSource === "AI_GENERATED" && aiConfidence) {
      const confTag = CONFIDENCE_TAGS[aiConfidence];
      if (confTag) desiredTags.add(confTag);
    }
  }

  // 2. Upsert each desired tag (create with default color if new)
  for (const tagName of desiredTags) {
    await prisma.tag.upsert({
      where: { name: tagName },
      create: {
        name: tagName,
        color: AUTO_TAG_COLORS[tagName] ?? "#6B7280",
        tagType: "AUTO",
      },
      update: {}, // Don't overwrite user-modified colors
    });
  }

  // 3. Get current auto-tag assignments for this entry
  const currentAutoAssignments = await prisma.catalogEntryTag.findMany({
    where: {
      catalogEntryId: entryId,
      tag: { tagType: "AUTO" },
    },
    include: { tag: true },
  });

  const currentAutoTagNames = new Set(
    currentAutoAssignments.map((a) => a.tag.name)
  );

  // 4. Remove stale auto-tags
  const staleIds = currentAutoAssignments
    .filter((a) => !desiredTags.has(a.tag.name))
    .map((a) => a.id);

  if (staleIds.length > 0) {
    await prisma.catalogEntryTag.deleteMany({
      where: { id: { in: staleIds } },
    });
  }

  // 5. Add missing auto-tags
  const missingTagNames = [...desiredTags].filter(
    (name) => !currentAutoTagNames.has(name)
  );

  if (missingTagNames.length > 0) {
    const tags = await prisma.tag.findMany({
      where: { name: { in: missingTagNames } },
    });

    for (const tag of tags) {
      await prisma.catalogEntryTag.upsert({
        where: {
          catalogEntryId_tagId: {
            catalogEntryId: entryId,
            tagId: tag.id,
          },
        },
        create: {
          catalogEntryId: entryId,
          tagId: tag.id,
        },
        update: {},
      });
    }
  }
}

/** Get all known auto-tag names (useful for filtering UI) */
export function getAutoTagNames(): string[] {
  return ALL_AUTO_TAG_NAMES;
}
