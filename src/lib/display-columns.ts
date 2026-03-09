import { prisma } from "@/lib/db";

/**
 * Resolve display columns for a list of table names using ServiceNow's
 * display value resolution chain:
 *
 *   1. display=true on the lowest sub-table (sys_dictionary)
 *   2. display=true on a parent table (inheritance chain)
 *   3. A field named name, u_name, or x_*_name
 *   4. A field named number, u_number, or x_*_number
 *   5. glide.record.display_value_default property (not available — skipped)
 *   6. sys_created_on
 *
 * Returns a map of table name → display column element name.
 * Tables with no resolvable display column are omitted from the result.
 */
export async function resolveDisplayColumns(
  snapshotId: string,
  tableNames: string[]
): Promise<Record<string, string>> {
  if (tableNames.length === 0) return {};

  // Load all tables for inheritance chain walking
  const allTables = await prisma.snapshotTable.findMany({
    where: { snapshotId },
    select: { name: true, superClassName: true },
  });
  const parentMap = new Map(allTables.map((t) => [t.name, t.superClassName]));

  // ── Step 1 & 2: Load all isDisplay=true columns for inheritance chain lookup ──
  const displayColumns = await prisma.snapshotColumn.findMany({
    where: {
      table: { snapshotId },
      isDisplay: true,
    },
    select: {
      element: true,
      definedOnTable: true,
    },
  });

  // Map: definedOnTable → display column element
  const displayByDefinedOn = new Map<string, string>();
  for (const col of displayColumns) {
    if (!displayByDefinedOn.has(col.definedOnTable)) {
      displayByDefinedOn.set(col.definedOnTable, col.element);
    }
  }

  // Collect tables that need the fallback chain
  const result: Record<string, string> = {};
  const needsFallback: string[] = [];

  for (const name of tableNames) {
    let current: string | null = name;
    let found = false;
    while (current) {
      const displayCol = displayByDefinedOn.get(current);
      if (displayCol) {
        result[name] = displayCol;
        found = true;
        break;
      }
      current = parentMap.get(current) ?? null;
    }
    if (!found) {
      needsFallback.push(name);
    }
  }

  // ── Steps 3, 4, 6: Convention-based fallback for tables without display=true ──
  if (needsFallback.length > 0) {
    // Collect all ancestor table names for the fallback tables
    const fallbackTableSets = new Map<string, string[]>();
    for (const name of needsFallback) {
      const chain: string[] = [];
      let current: string | null = name;
      while (current) {
        chain.push(current);
        current = parentMap.get(current) ?? null;
      }
      fallbackTableSets.set(name, chain);
    }

    // All table names we need columns for (requested + ancestors)
    const allFallbackTables = new Set<string>();
    for (const chain of fallbackTableSets.values()) {
      for (const t of chain) allFallbackTables.add(t);
    }

    // Fetch column elements for these tables (only the fields we care about)
    const candidateColumns = await prisma.snapshotColumn.findMany({
      where: {
        table: { snapshotId },
        definedOnTable: { in: [...allFallbackTables] },
        element: {
          in: ["name", "number", "sys_created_on"],
        },
      },
      select: {
        element: true,
        definedOnTable: true,
      },
    });

    // Also check for u_name/u_number/x_*_name/x_*_number patterns
    const prefixedColumns = await prisma.snapshotColumn.findMany({
      where: {
        table: { snapshotId },
        definedOnTable: { in: [...allFallbackTables] },
        OR: [
          { element: { startsWith: "u_name" } },
          { element: { startsWith: "x_" } },
          { element: { startsWith: "u_number" } },
        ],
      },
      select: {
        element: true,
        definedOnTable: true,
      },
    });

    // Filter prefixed columns to only x_*_name / x_*_number patterns
    const allCandidates = [
      ...candidateColumns,
      ...prefixedColumns.filter((c) => {
        if (c.element === "u_name" || c.element === "u_number") return true;
        if (c.element.startsWith("x_") && c.element.endsWith("_name"))
          return true;
        if (c.element.startsWith("x_") && c.element.endsWith("_number"))
          return true;
        return false;
      }),
    ];

    // Build lookup: definedOnTable → Set of candidate element names
    const candidatesByTable = new Map<string, Set<string>>();
    for (const col of allCandidates) {
      const set = candidatesByTable.get(col.definedOnTable) ?? new Set();
      set.add(col.element);
      candidatesByTable.set(col.definedOnTable, set);
    }

    // For each fallback table, walk the inheritance chain checking conventions
    for (const name of needsFallback) {
      const chain = fallbackTableSets.get(name)!;

      // Collect all available candidate columns across the inheritance chain
      const available = new Set<string>();
      for (const t of chain) {
        const cols = candidatesByTable.get(t);
        if (cols) {
          for (const c of cols) available.add(c);
        }
      }

      // Step 3: name, u_name, x_*_name (prefer exact "name" first)
      if (available.has("name")) {
        result[name] = "name";
        continue;
      }
      if (available.has("u_name")) {
        result[name] = "u_name";
        continue;
      }
      const xName = [...available].find(
        (e) => e.startsWith("x_") && e.endsWith("_name")
      );
      if (xName) {
        result[name] = xName;
        continue;
      }

      // Step 4: number, u_number, x_*_number
      if (available.has("number")) {
        result[name] = "number";
        continue;
      }
      if (available.has("u_number")) {
        result[name] = "u_number";
        continue;
      }
      const xNumber = [...available].find(
        (e) => e.startsWith("x_") && e.endsWith("_number")
      );
      if (xNumber) {
        result[name] = xNumber;
        continue;
      }

      // Step 6: sys_created_on (always exists)
      if (available.has("sys_created_on")) {
        result[name] = "sys_created_on";
      }
    }
  }

  return result;
}
