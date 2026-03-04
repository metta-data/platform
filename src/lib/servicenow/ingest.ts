import { prisma } from "@/lib/db";
import { ServiceNowClient } from "./client";
import type { ServiceNowCredentials, IngestProgress } from "./types";

const DB_BATCH_SIZE = 1000;

export async function ingestFromInstance(
  snapshotId: string,
  credentials: ServiceNowCredentials,
  onProgress?: (progress: IngestProgress) => void
): Promise<void> {
  const client = new ServiceNowClient(credentials);

  try {
    // Phase 1: Fetch tables
    await prisma.schemaSnapshot.update({
      where: { id: snapshotId },
      data: {
        status: "INGESTING_TABLES",
        ingestStartedAt: new Date(),
      },
    });

    onProgress?.({
      phase: "tables",
      current: 0,
      total: 0,
      message: "Fetching tables from ServiceNow...",
    });

    const rawTables = await client.fetchAllTables((current, total) => {
      onProgress?.({
        phase: "tables",
        current,
        total,
        message: `Fetching tables: ${current}/${total}`,
      });
    });

    // Parse tables and resolve superClassName via sys_id lookup
    const parsedTables = rawTables.map((r) =>
      ServiceNowClient.parseTableRecord(r)
    );

    if (parsedTables.length === 0) {
      throw new Error(
        "No tables returned from ServiceNow. Check that the instance URL and credentials are correct, and that the user has read access to sys_db_object."
      );
    }

    // Resolve superClassName: super_class is a reference field where value = sys_id
    // Build sysId → name lookup, then resolve each table's parent name
    const sysIdToName = new Map(parsedTables.map((t) => [t.sysId, t.name]));
    for (const table of parsedTables) {
      if (table.superClassSysId) {
        table.superClassName = sysIdToName.get(table.superClassSysId) || null;
      }
    }

    // Remove superClassSysId before DB insertion (not a DB column)
    for (let i = 0; i < parsedTables.length; i += DB_BATCH_SIZE) {
      const batch = parsedTables.slice(i, i + DB_BATCH_SIZE);
      await prisma.snapshotTable.createMany({
        data: batch.map(({ superClassSysId: _, ...t }) => ({
          snapshotId,
          ...t,
        })),
        skipDuplicates: true,
      });
    }

    onProgress?.({
      phase: "tables",
      current: parsedTables.length,
      total: parsedTables.length,
      message: `Inserted ${parsedTables.length} tables`,
    });

    // Phase 2: Fetch columns
    await prisma.schemaSnapshot.update({
      where: { id: snapshotId },
      data: { status: "INGESTING_COLUMNS" },
    });

    onProgress?.({
      phase: "columns",
      current: 0,
      total: 0,
      message: "Fetching columns from ServiceNow...",
    });

    const rawColumns = await client.fetchAllColumns((current, total) => {
      onProgress?.({
        phase: "columns",
        current,
        total,
        message: `Fetching columns: ${current}/${total}`,
      });
    });

    // Build a set of table names in this snapshot for fast lookup
    const tableNameSet = new Set(parsedTables.map((t) => t.name));

    // Build table ID lookup: need the DB IDs to link columns
    const tableIdMap = new Map<string, string>();
    const dbTables = await prisma.snapshotTable.findMany({
      where: { snapshotId },
      select: { id: true, name: true },
    });
    for (const t of dbTables) {
      tableIdMap.set(t.name, t.id);
    }

    // Parse and group columns by the table they belong to
    // Each sys_dictionary record's "name" field tells us which table it's defined on.
    // We need to associate columns with the table they belong to (which may be inherited).
    // For now, we store columns under the table they're defined on (definedOnTable).
    const parsedColumns = rawColumns
      .map((r) => ServiceNowClient.parseColumnRecord(r))
      .filter((c) => tableNameSet.has(c.definedOnTable));

    // Resolve referenceTable: reference field value = sys_id of target table in sys_db_object
    // Use the same sysIdToName map built for super_class resolution
    for (const col of parsedColumns) {
      if (col.referenceTableSysId) {
        col.referenceTable = sysIdToName.get(col.referenceTableSysId) || null;
      }
    }

    // Insert columns in batches, linked to their defining table
    let insertedCount = 0;
    for (let i = 0; i < parsedColumns.length; i += DB_BATCH_SIZE) {
      const batch = parsedColumns.slice(i, i + DB_BATCH_SIZE);
      const data = batch
        .map((c) => {
          const tableId = tableIdMap.get(c.definedOnTable);
          if (!tableId) return null;
          // Strip referenceTableSysId (not a DB column)
          const { referenceTableSysId: _, ...rest } = c;
          return { tableId, ...rest };
        })
        .filter((d): d is NonNullable<typeof d> => d !== null);

      if (data.length > 0) {
        await prisma.snapshotColumn.createMany({
          data,
          skipDuplicates: true,
        });
        insertedCount += data.length;
      }

      onProgress?.({
        phase: "columns",
        current: Math.min(i + DB_BATCH_SIZE, parsedColumns.length),
        total: parsedColumns.length,
        message: `Inserting columns: ${insertedCount} inserted`,
      });
    }

    // Phase 3: Post-processing
    await prisma.schemaSnapshot.update({
      where: { id: snapshotId },
      data: { status: "PROCESSING" },
    });

    onProgress?.({
      phase: "processing",
      current: 0,
      total: 1,
      message: "Resolving column inheritance...",
    });

    await computeDefinedOnTable(snapshotId);

    onProgress?.({
      phase: "processing",
      current: 0,
      total: 1,
      message: "Computing table statistics...",
    });

    await computeTableCounts(snapshotId);

    // Update snapshot with final counts
    const tableCount = await prisma.snapshotTable.count({
      where: { snapshotId },
    });
    const columnCount = await prisma.snapshotColumn.count({
      where: { table: { snapshotId } },
    });

    await prisma.schemaSnapshot.update({
      where: { id: snapshotId },
      data: {
        status: "COMPLETED",
        tableCount,
        columnCount,
        ingestCompletedAt: new Date(),
      },
    });

    onProgress?.({
      phase: "complete",
      current: 1,
      total: 1,
      message: `Ingestion complete: ${tableCount} tables, ${columnCount} columns`,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error during ingestion";
    await prisma.schemaSnapshot.update({
      where: { id: snapshotId },
      data: {
        status: "FAILED",
        errorMessage: message,
      },
    });

    onProgress?.({
      phase: "error",
      current: 0,
      total: 0,
      message,
    });

    throw error;
  }
}

/**
 * ServiceNow duplicates sys_dictionary entries at every level of the hierarchy.
 * A column like "asset" on cmdb_ci has separate dictionary entries for cmdb_ci,
 * cmdb_ci_hardware, cmdb_ci_computer, cmdb_ci_server, etc.
 *
 * This function resolves each column's true `definedOnTable` by finding the
 * topmost ancestor in the inheritance chain that also has that column element.
 */
async function computeDefinedOnTable(snapshotId: string): Promise<void> {
  // Fetch all tables with their column elements
  const tables = await prisma.snapshotTable.findMany({
    where: { snapshotId },
    select: {
      id: true,
      name: true,
      superClassName: true,
      columns: { select: { id: true, element: true } },
    },
  });

  const tableByName = new Map(tables.map((t) => [t.name, t]));

  // Pre-build column element sets for each table
  const tableElements = new Map<string, Set<string>>();
  for (const t of tables) {
    tableElements.set(t.name, new Set(t.columns.map((c) => c.element)));
  }

  // For each table, determine the true introducing table for each column
  const updates: { id: string; definedOnTable: string }[] = [];

  for (const table of tables) {
    if (!table.superClassName) continue; // root tables — all columns are own

    // Build inheritance chain: [self, parent, grandparent, ..., root]
    const chain: string[] = [table.name];
    let p: string | null = table.superClassName;
    while (p && tableByName.has(p)) {
      chain.push(p);
      p = tableByName.get(p)!.superClassName;
    }

    if (chain.length <= 1) continue; // no ancestors

    // Walk from root → leaf to find where each column was first introduced
    const reversedChain = [...chain].reverse(); // root first

    for (const col of table.columns) {
      // Find the topmost ancestor that has this column element
      for (const ancestor of reversedChain) {
        if (tableElements.get(ancestor)?.has(col.element)) {
          if (ancestor !== table.name) {
            updates.push({ id: col.id, definedOnTable: ancestor });
          }
          break;
        }
      }
    }
  }

  // Batch update in chunks
  for (let i = 0; i < updates.length; i += DB_BATCH_SIZE) {
    const batch = updates.slice(i, i + DB_BATCH_SIZE);
    await Promise.all(
      batch.map((u) =>
        prisma.snapshotColumn.update({
          where: { id: u.id },
          data: { definedOnTable: u.definedOnTable },
        })
      )
    );
  }
}

async function computeTableCounts(snapshotId: string): Promise<void> {
  const tables = await prisma.snapshotTable.findMany({
    where: { snapshotId },
    select: { id: true, name: true, superClassName: true },
  });

  const childCountMap = new Map<string, number>();
  for (const t of tables) {
    if (t.superClassName) {
      childCountMap.set(
        t.superClassName,
        (childCountMap.get(t.superClassName) || 0) + 1
      );
    }
  }

  // Build inheritance chain for each table to compute totalColumnCount
  const tableNameToId = new Map(tables.map((t) => [t.name, t.id]));
  const tableNameToParent = new Map(
    tables.map((t) => [t.name, t.superClassName])
  );

  for (const table of tables) {
    // Count own columns (columns defined on this table)
    const ownCount = await prisma.snapshotColumn.count({
      where: { tableId: table.id, definedOnTable: table.name },
    });

    // Count total columns (own + inherited from all ancestors)
    // Walk up the chain and count columns from each ancestor
    let totalCount = ownCount;
    let parent = table.superClassName;
    while (parent) {
      const parentId = tableNameToId.get(parent);
      if (parentId) {
        const parentOwnCount = await prisma.snapshotColumn.count({
          where: { tableId: parentId, definedOnTable: parent },
        });
        totalCount += parentOwnCount;
      }
      parent = tableNameToParent.get(parent) ?? null;
    }

    await prisma.snapshotTable.update({
      where: { id: table.id },
      data: {
        ownColumnCount: ownCount,
        totalColumnCount: totalCount,
        childTableCount: childCountMap.get(table.name) || 0,
      },
    });
  }
}
