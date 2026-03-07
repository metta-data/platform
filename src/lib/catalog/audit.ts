/**
 * Shared audit utility for CatalogEntry field changes.
 *
 * Compares old and new values for all tracked fields and creates
 * CatalogFieldAudit records for each change.
 */

type PrismaClient = {
  catalogFieldAudit: {
    create: (args: { data: AuditRecord }) => Promise<unknown>;
    createMany: (args: { data: AuditRecord[] }) => Promise<unknown>;
  };
};

interface AuditRecord {
  catalogEntryId: string;
  fieldName: string;
  oldValue: string | null;
  newValue: string | null;
  comment: string | null;
  userId: string | null;
}

/** Fields we track in audit history, with human-readable labels */
const AUDITED_FIELDS = [
  "definition",
  "definitionSource",
  "definitionSourceDetail",
  "citationUrl",
  "validationStatus",
  "stewardId",
  "label",
  "internalType",
] as const;

/** Map field names to readable labels for display */
export const FIELD_LABELS: Record<string, string> = {
  definition: "definition",
  definitionSource: "definition source",
  definitionSourceDetail: "source detail",
  citationUrl: "citation URL",
  validationStatus: "validation status",
  stewardId: "steward",
  label: "label",
  internalType: "type",
};

/**
 * Compare old and new values for all tracked fields and create audit records.
 * Works with both the main prisma client and transaction clients.
 *
 * @param tx - Prisma client or transaction
 * @param entryId - The catalog entry ID
 * @param oldValues - The entry's current values (before update)
 * @param newValues - The values being set (only include changed fields)
 * @param userId - The user making the change (null if system)
 * @param comment - Optional comment for the change
 * @param resolvedNames - Optional map of ID fields to resolved display names
 *   e.g. { stewardId: { old: "Alice", new: "Bob" } }
 */
export async function auditFieldChanges(
  tx: PrismaClient,
  entryId: string,
  oldValues: Record<string, unknown>,
  newValues: Record<string, unknown>,
  userId: string | null,
  comment: string | null = null,
  resolvedNames?: Record<string, { old: string | null; new: string | null }>
): Promise<void> {
  const records: AuditRecord[] = [];

  for (const field of AUDITED_FIELDS) {
    if (!(field in newValues)) continue;

    const oldVal = oldValues[field];
    const newVal = newValues[field];

    // Skip if value hasn't actually changed
    if (stringify(oldVal) === stringify(newVal)) continue;

    // Use resolved names for ID fields (stewardId, validatedById) if provided
    const resolved = resolvedNames?.[field];
    records.push({
      catalogEntryId: entryId,
      fieldName: FIELD_LABELS[field] || field,
      oldValue: resolved ? resolved.old : stringify(oldVal),
      newValue: resolved ? resolved.new : stringify(newVal),
      comment,
      userId,
    });
  }

  if (records.length === 0) return;

  if (records.length === 1) {
    await tx.catalogFieldAudit.create({ data: records[0] });
  } else {
    await tx.catalogFieldAudit.createMany({ data: records });
  }
}

/**
 * Bulk version — creates audit records for many entries at once.
 * All entries are assumed to be going through the same field change.
 *
 * @param resolvedNames - Shared resolved display names for the new value
 *   e.g. { stewardId: { new: "Bob" } }
 * Each entry can also provide per-entry resolved old names via
 *   resolvedOldNames, e.g. { stewardId: "Alice" }
 */
export async function auditFieldChangesBulk(
  tx: PrismaClient,
  entries: {
    id: string;
    oldValues: Record<string, unknown>;
    resolvedOldNames?: Record<string, string | null>;
  }[],
  newValues: Record<string, unknown>,
  userId: string | null,
  comment: string | null = null,
  resolvedNames?: Record<string, { new: string | null }>
): Promise<void> {
  const records: AuditRecord[] = [];

  for (const entry of entries) {
    for (const field of AUDITED_FIELDS) {
      if (!(field in newValues)) continue;

      const oldVal = entry.oldValues[field];
      const newVal = newValues[field];

      if (stringify(oldVal) === stringify(newVal)) continue;

      const resolvedOld = entry.resolvedOldNames?.[field] ?? null;
      const resolvedNew = resolvedNames?.[field]?.new ?? null;
      records.push({
        catalogEntryId: entry.id,
        fieldName: FIELD_LABELS[field] || field,
        oldValue: resolvedOld !== null ? resolvedOld : stringify(oldVal),
        newValue: resolvedNew !== null ? resolvedNew : stringify(newVal),
        comment,
        userId,
      });
    }
  }

  if (records.length === 0) return;

  // Batch createMany in chunks of 500 to stay within limits
  const BATCH = 500;
  for (let i = 0; i < records.length; i += BATCH) {
    await tx.catalogFieldAudit.createMany({
      data: records.slice(i, i + BATCH),
    });
  }
}

/** Convert a value to a string for storage, null stays null */
function stringify(val: unknown): string | null {
  if (val === null || val === undefined) return null;
  if (val instanceof Date) return val.toISOString();
  return String(val);
}
