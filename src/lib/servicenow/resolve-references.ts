/**
 * Reference table resolution for ServiceNow reference-type columns.
 *
 * ServiceNow reference fields store a sys_id pointing at a target table,
 * but the value returned by the API can be a table name, a sys_id, or a
 * label — depending on instance configuration and field type.
 *
 * This module provides a single resolution chain used by:
 *  - Initial ingestion (ingest.ts)
 *  - Diagnose-references endpoint
 *  - Repair-references endpoint
 */

export interface TableInfo {
  name: string;
  label: string;
  sysId: string;
}

export interface ReferenceLookups {
  /** Set of all known table names in the snapshot */
  tableNameSet: Set<string>;
  /** Map from sys_id → table name */
  sysIdToName: Map<string, string>;
  /** Map from label → table name (exact match, first wins) */
  labelToName: Map<string, string>;
  /** Map from lowercase label → table name (case-insensitive, first wins) */
  lowerLabelToName: Map<string, string>;
}

export interface ResolveResult {
  /** The resolved table name, or null if unresolvable */
  resolvedName: string | null;
  /** Which step resolved it */
  resolvedBy: "name" | "sysId" | "label" | "labelCI" | null;
}

/**
 * Build the lookup maps needed for reference resolution from a list of tables.
 */
export function buildReferenceLookups(tables: TableInfo[]): ReferenceLookups {
  const tableNameSet = new Set(tables.map((t) => t.name));
  const sysIdToName = new Map(tables.map((t) => [t.sysId, t.name]));

  const labelToName = new Map<string, string>();
  const lowerLabelToName = new Map<string, string>();
  for (const t of tables) {
    if (!labelToName.has(t.label)) {
      labelToName.set(t.label, t.name);
    }
    const lower = t.label.toLowerCase();
    if (!lowerLabelToName.has(lower)) {
      lowerLabelToName.set(lower, t.name);
    }
  }

  return { tableNameSet, sysIdToName, labelToName, lowerLabelToName };
}

/**
 * Resolve a reference table value using the 4-step chain:
 *
 *  1. Direct table name match (value IS a known table name)
 *  2. sys_id lookup (value is a sys_db_object sys_id)
 *  3. Label lookup — exact match (value is a table label like "User")
 *  4. Label lookup — case-insensitive (handles "user" → "User" → "sys_user")
 *
 * @param refValue  The reference value (typically from reference.value / referenceTableSysId)
 * @param refLabel  The display label (typically from reference.display_value / referenceTableLabel)
 * @param lookups   Pre-built lookup maps from buildReferenceLookups()
 */
export function resolveReferenceTable(
  refValue: string,
  refLabel: string | null | undefined,
  lookups: ReferenceLookups
): ResolveResult {
  // Step 1: Direct table name match
  if (lookups.tableNameSet.has(refValue)) {
    return { resolvedName: refValue, resolvedBy: "name" };
  }

  // Step 2: sys_id lookup
  const bySysId = lookups.sysIdToName.get(refValue);
  if (bySysId) {
    return { resolvedName: bySysId, resolvedBy: "sysId" };
  }

  // Step 3: Label lookup (exact match)
  const labelStr = refLabel ?? "";
  const byLabel = lookups.labelToName.get(labelStr);
  if (byLabel) {
    return { resolvedName: byLabel, resolvedBy: "label" };
  }

  // Step 4: Label lookup (case-insensitive)
  const byLabelCI = lookups.lowerLabelToName.get(labelStr.toLowerCase());
  if (byLabelCI) {
    return { resolvedName: byLabelCI, resolvedBy: "labelCI" };
  }

  // Unresolvable
  return { resolvedName: null, resolvedBy: null };
}

/**
 * Validate whether a referenceTable value points to a known table.
 * Used by the diagnose-references endpoint (no sys_id available, just the stored value).
 *
 * Resolution chain is shorter since we only have the stored referenceTable string:
 *  1. Direct table name match
 *  2. Label lookup — exact match
 *  3. Label lookup — case-insensitive
 */
export function validateReferenceTable(
  storedValue: string,
  lookups: Pick<ReferenceLookups, "tableNameSet" | "labelToName" | "lowerLabelToName">
): { valid: boolean; suggestedName: string | null; resolvedBy: string | null } {
  if (lookups.tableNameSet.has(storedValue)) {
    return { valid: true, suggestedName: null, resolvedBy: null };
  }

  const byLabel = lookups.labelToName.get(storedValue) ?? null;
  if (byLabel) {
    return { valid: false, suggestedName: byLabel, resolvedBy: "label" };
  }

  const byLabelCI =
    lookups.lowerLabelToName.get(storedValue.toLowerCase()) ?? null;
  if (byLabelCI) {
    return { valid: false, suggestedName: byLabelCI, resolvedBy: "labelCI" };
  }

  return { valid: false, suggestedName: null, resolvedBy: null };
}
