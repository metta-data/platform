import type {
  ComparisonResult,
  TableDiff,
  TableModification,
  ColumnDiff,
  ColumnModification,
  ColumnDetail,
} from "@/types";

interface SnapshotData {
  tables: Map<
    string,
    {
      name: string;
      label: string;
      columns: Map<string, ColumnDetail>;
    }
  >;
}

const COMPARED_FIELDS: (keyof ColumnDetail)[] = [
  "internalType",
  "maxLength",
  "isMandatory",
  "isReadOnly",
  "referenceTable",
  "defaultValue",
];

export function compareSnapshots(
  baseline: SnapshotData,
  target: SnapshotData
): ComparisonResult {
  const addedTables: TableDiff[] = [];
  const removedTables: TableDiff[] = [];
  const modifiedTables: TableModification[] = [];
  let unchangedTableCount = 0;

  let addedColumnCount = 0;
  let removedColumnCount = 0;
  let modifiedColumnCount = 0;

  // Find added tables (in target but not in baseline)
  for (const [name, table] of target.tables) {
    if (!baseline.tables.has(name)) {
      addedTables.push({
        name: table.name,
        label: table.label,
        columnCount: table.columns.size,
      });
      addedColumnCount += table.columns.size;
    }
  }

  // Find removed tables (in baseline but not in target)
  for (const [name, table] of baseline.tables) {
    if (!target.tables.has(name)) {
      removedTables.push({
        name: table.name,
        label: table.label,
        columnCount: table.columns.size,
      });
      removedColumnCount += table.columns.size;
    }
  }

  // Compare common tables
  for (const [name, baseTable] of baseline.tables) {
    const targetTable = target.tables.get(name);
    if (!targetTable) continue;

    const addedCols: ColumnDiff[] = [];
    const removedCols: ColumnDiff[] = [];
    const modifiedCols: ColumnModification[] = [];

    // Added columns
    for (const [element, col] of targetTable.columns) {
      if (!baseTable.columns.has(element)) {
        addedCols.push({
          element: col.element,
          label: col.label,
          internalType: col.internalType,
        });
      }
    }

    // Removed columns
    for (const [element, col] of baseTable.columns) {
      if (!targetTable.columns.has(element)) {
        removedCols.push({
          element: col.element,
          label: col.label,
          internalType: col.internalType,
        });
      }
    }

    // Modified columns
    for (const [element, baseCol] of baseTable.columns) {
      const targetCol = targetTable.columns.get(element);
      if (!targetCol) continue;

      const changes: ColumnModification["changes"] = [];
      for (const field of COMPARED_FIELDS) {
        const oldVal = String(baseCol[field] ?? "");
        const newVal = String(targetCol[field] ?? "");
        if (oldVal !== newVal) {
          changes.push({
            field,
            oldValue: baseCol[field] != null ? String(baseCol[field]) : null,
            newValue: targetCol[field] != null ? String(targetCol[field]) : null,
          });
        }
      }

      if (changes.length > 0) {
        modifiedCols.push({
          element,
          label: baseCol.label,
          changes,
        });
      }
    }

    if (
      addedCols.length > 0 ||
      removedCols.length > 0 ||
      modifiedCols.length > 0
    ) {
      modifiedTables.push({
        tableName: name,
        tableLabel: baseTable.label,
        addedColumns: addedCols,
        removedColumns: removedCols,
        modifiedColumns: modifiedCols,
      });
      addedColumnCount += addedCols.length;
      removedColumnCount += removedCols.length;
      modifiedColumnCount += modifiedCols.length;
    } else {
      unchangedTableCount++;
    }
  }

  // Sort results
  addedTables.sort((a, b) => a.name.localeCompare(b.name));
  removedTables.sort((a, b) => a.name.localeCompare(b.name));
  modifiedTables.sort((a, b) => a.tableName.localeCompare(b.tableName));

  return {
    addedTables,
    removedTables,
    modifiedTables,
    unchangedTableCount,
    summary: {
      addedTableCount: addedTables.length,
      removedTableCount: removedTables.length,
      modifiedTableCount: modifiedTables.length,
      addedColumnCount,
      removedColumnCount,
      modifiedColumnCount,
    },
  };
}
