import { prisma } from "@/lib/db";

/**
 * Resolve display columns for a list of table names using a refined
 * ServiceNow-style resolution chain:
 *
 *   1. display=true on the table itself (sys_dictionary)
 *   2. Convention-based: name, u_name, x_*_name across inheritance chain
 *   3. Convention-based: number, u_number, x_*_number across inheritance chain
 *   4. display=true on a parent table (inheritance chain walk-up)
 *   5. sys_created_on
 *
 * Conventions are checked before ancestor display flags because ancestor
 * display columns (e.g. sys_row on sys_metadata) are often generic and
 * wrong for descendant tables that have their own name/number fields.
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

  // ── Load all isDisplay=true columns ──
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

  // ── Build inheritance chains and convention candidate lookup ──

  // Build inheritance chain for every requested table
  const chainsByTable = new Map<string, string[]>();
  const allChainTables = new Set<string>();
  for (const name of tableNames) {
    const chain: string[] = [];
    let current: string | null = name;
    while (current) {
      chain.push(current);
      allChainTables.add(current);
      current = parentMap.get(current) ?? null;
    }
    chainsByTable.set(name, chain);
  }

  // Fetch convention-based candidate columns across all chain tables
  const candidateColumns = await prisma.snapshotColumn.findMany({
    where: {
      table: { snapshotId },
      definedOnTable: { in: [...allChainTables] },
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
      definedOnTable: { in: [...allChainTables] },
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

  // ── Resolve each table ──
  const result: Record<string, string> = {};

  for (const name of tableNames) {
    const chain = chainsByTable.get(name)!;

    // Step 1: isDisplay=true on the table itself
    const ownDisplay = displayByDefinedOn.get(name);
    if (ownDisplay) {
      result[name] = ownDisplay;
      continue;
    }

    // Step 2 & 3: Convention-based across inheritance chain
    const available = new Set<string>();
    for (const t of chain) {
      const cols = candidatesByTable.get(t);
      if (cols) {
        for (const c of cols) available.add(c);
      }
    }

    // Step 2: name, u_name, x_*_name
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

    // Step 3: number, u_number, x_*_number
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

    // Step 4: isDisplay=true on ancestor tables (walk up)
    for (let i = 1; i < chain.length; i++) {
      const ancestorDisplay = displayByDefinedOn.get(chain[i]);
      if (ancestorDisplay) {
        result[name] = ancestorDisplay;
        break;
      }
    }
    if (result[name]) continue;

    // Step 5: sys_created_on
    if (available.has("sys_created_on")) {
      result[name] = "sys_created_on";
    }
  }

  return result;
}
