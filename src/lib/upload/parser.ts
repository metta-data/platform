import { prisma } from "@/lib/db";

const DB_BATCH_SIZE = 1000;

interface UploadedTable {
  name: string;
  label: string;
  super_class?: string;
  scope?: string;
  scope_label?: string;
  is_extendable?: boolean;
  number_prefix?: string;
  columns: UploadedColumn[];
}

interface UploadedColumn {
  element: string;
  label: string;
  internal_type: string;
  max_length?: number | null;
  mandatory?: boolean;
  read_only?: boolean;
  active?: boolean;
  reference?: string | null;
  default_value?: string | null;
}

interface UploadedSchema {
  format: string;
  tables: UploadedTable[];
}

export async function parseAndIngestJson(
  snapshotId: string,
  jsonData: UploadedSchema
): Promise<{ tableCount: number; columnCount: number }> {
  if (!jsonData.tables || !Array.isArray(jsonData.tables)) {
    throw new Error("Invalid schema format: missing 'tables' array");
  }

  await prisma.schemaSnapshot.update({
    where: { id: snapshotId },
    data: { status: "INGESTING_TABLES" },
  });

  // Insert tables in batches
  const tableData = jsonData.tables.map((t) => ({
    snapshotId,
    sysId: `upload-${t.name}`,
    name: t.name,
    label: t.label || t.name,
    superClassName: t.super_class || null,
    scopeName: t.scope || null,
    scopeLabel: t.scope_label || t.scope || null,
    isExtendable: t.is_extendable ?? true,
    numberPrefix: t.number_prefix || null,
  }));

  for (let i = 0; i < tableData.length; i += DB_BATCH_SIZE) {
    const batch = tableData.slice(i, i + DB_BATCH_SIZE);
    await prisma.snapshotTable.createMany({
      data: batch,
      skipDuplicates: true,
    });
  }

  // Get table ID map
  const dbTables = await prisma.snapshotTable.findMany({
    where: { snapshotId },
    select: { id: true, name: true },
  });
  const tableIdMap = new Map(dbTables.map((t) => [t.name, t.id]));

  await prisma.schemaSnapshot.update({
    where: { id: snapshotId },
    data: { status: "INGESTING_COLUMNS" },
  });

  // Insert columns
  let totalColumnCount = 0;
  for (const table of jsonData.tables) {
    const tableId = tableIdMap.get(table.name);
    if (!tableId || !table.columns) continue;

    const columnData = table.columns.map((c) => ({
      tableId,
      sysId: `upload-${table.name}-${c.element}`,
      element: c.element,
      label: c.label || c.element,
      definedOnTable: table.name,
      internalType: c.internal_type || "string",
      referenceTable: c.reference || null,
      maxLength: c.max_length ?? null,
      isMandatory: c.mandatory ?? false,
      isReadOnly: c.read_only ?? false,
      isActive: c.active ?? true,
      defaultValue: c.default_value || null,
    }));

    for (let i = 0; i < columnData.length; i += DB_BATCH_SIZE) {
      const batch = columnData.slice(i, i + DB_BATCH_SIZE);
      await prisma.snapshotColumn.createMany({
        data: batch,
        skipDuplicates: true,
      });
    }

    totalColumnCount += columnData.length;
  }

  // Post-processing: compute counts
  await prisma.schemaSnapshot.update({
    where: { id: snapshotId },
    data: { status: "PROCESSING" },
  });

  // Compute child table counts
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

  for (const table of tables) {
    const ownCount = await prisma.snapshotColumn.count({
      where: { tableId: table.id },
    });

    await prisma.snapshotTable.update({
      where: { id: table.id },
      data: {
        ownColumnCount: ownCount,
        totalColumnCount: ownCount, // For uploads, we only have own columns
        childTableCount: childCountMap.get(table.name) || 0,
      },
    });
  }

  await prisma.schemaSnapshot.update({
    where: { id: snapshotId },
    data: {
      status: "COMPLETED",
      tableCount: tableData.length,
      columnCount: totalColumnCount,
      ingestCompletedAt: new Date(),
    },
  });

  return { tableCount: tableData.length, columnCount: totalColumnCount };
}

export async function parseCsvUpload(
  snapshotId: string,
  tablesCsv: string,
  columnsCsv: string
): Promise<{ tableCount: number; columnCount: number }> {
  const parsedTables = parseCsvRows(tablesCsv);
  const parsedColumns = parseCsvRows(columnsCsv);

  // Convert CSV rows to our JSON format
  const tableMap = new Map<string, UploadedTable>();

  for (const row of parsedTables) {
    const name = row["name"] || row["Name"];
    if (!name) continue;
    tableMap.set(name, {
      name,
      label: row["label"] || row["Label"] || name,
      super_class: row["super_class"] || row["Super class"] || undefined,
      scope: row["sys_scope"] || row["Scope"] || undefined,
      columns: [],
    });
  }

  for (const row of parsedColumns) {
    const tableName = row["name"] || row["Name"];
    const element = row["element"] || row["Element"];
    if (!tableName || !element) continue;

    const table = tableMap.get(tableName);
    if (!table) continue;

    table.columns.push({
      element,
      label: row["column_label"] || row["Column label"] || element,
      internal_type:
        row["internal_type"] || row["Internal type"] || "string",
      max_length: row["max_length"]
        ? parseInt(row["max_length"], 10)
        : null,
      mandatory: row["mandatory"] === "true",
      read_only: row["read_only"] === "true",
      reference: row["reference"] || null,
    });
  }

  const schema: UploadedSchema = {
    format: "csv-upload",
    tables: Array.from(tableMap.values()),
  };

  return parseAndIngestJson(snapshotId, schema);
}

function parseCsvRows(csv: string): Record<string, string>[] {
  const lines = csv.split("\n").filter((l) => l.trim());
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]);
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j] || "";
    }
    rows.push(row);
  }

  return rows;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
  }
  result.push(current.trim());

  return result;
}
