"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { useExplorerStore } from "@/stores/explorer-store";
import {
  X,
  Copy,
  Check,
  ChevronRight,
  Terminal,
  Globe,
  Trash2,
  Server,
  Snowflake,
} from "lucide-react";

type OutputMode = "api" | "query" | "snowflake" | null;

/** Field types that use choice lists in ServiceNow (lowercase for comparison) */
const CHOICE_TYPES = new Set(["choice", "integer", "float"]);

function buildSnowflakeSql(
  locator: string,
  tableName: string,
  fields: {
    element: string;
    internalType: string;
    referenceTable: string | null;
    dotWalkFields: { element: string; label: string }[];
  }[],
  displayColumnMap: Record<string, string | null>
): string {
  const prefix = locator ? `${locator}.` : "";
  const tbl = `${tableName.toUpperCase()}__VIEW`;
  const fullTable = `${prefix}${tbl}`;

  // No fields selected → open query returning all columns
  if (fields.length === 0) {
    return `SELECT *\nFROM ${fullTable}\nLIMIT 10;`;
  }

  // Pre-scan: do any fields produce JOINs? If so we need qualified column names.
  const hasJoins = fields.some(
    (f) =>
      f.referenceTable ||
      CHOICE_TYPES.has(f.internalType.toLowerCase())
  );
  const q = hasJoins ? `${tbl}.` : "";

  const selectCols: string[] = [];
  const joins: string[] = [];

  for (const field of fields) {
    const col = field.element.toUpperCase();
    const type = field.internalType.toLowerCase();
    const isRef = !!field.referenceTable;
    const isRefType = type === "reference";
    const isChoice = CHOICE_TYPES.has(type);

    selectCols.push(`${q}${col}`);

    // ── Reference field → LEFT JOIN referenced table ──
    // Reference columns in Snowflake store JSON {"value":"<sys_id>", ...};
    // use PARSE_JSON to extract the GUID for the join condition.
    // The JOIN is always emitted so the display column can be added
    // progressively once the async displayColumnCache loads.
    if (isRef) {
      const refAlias = `ref_${field.element}`;
      const refView = `${field.referenceTable!.toUpperCase()}__VIEW`;

      joins.push(
        `LEFT JOIN ${prefix}${refView} ${refAlias}\n  ON PARSE_JSON(${q}${col}):value::STRING = ${refAlias}.SYS_ID`
      );

      // Auto-include the display value column (once cache is loaded)
      const displayCol = displayColumnMap[field.referenceTable!];
      const alreadyDotWalked = displayCol && field.dotWalkFields.some(
        (dw) => dw.element.toLowerCase() === displayCol.toLowerCase()
      );
      if (displayCol && !alreadyDotWalked) {
        selectCols.push(
          `${refAlias}.${displayCol.toUpperCase()} AS ${col}__DISPLAY`
        );
      }

      // Explicit dot-walk fields
      if (field.dotWalkFields.length > 0) {
        for (const dw of field.dotWalkFields) {
          selectCols.push(
            `${refAlias}.${dw.element.toUpperCase()} AS ${col}__${dw.element.toUpperCase()}`
          );
        }
      }
    } else if (isRefType) {
      // Reference type but target table unknown — hint only
      joins.push(
        `-- TODO: ${col} is a reference field (target unknown, re-ingest to resolve)`
      );
    }

    // ── Choice field → LEFT JOIN SYS_CHOICE (reference wins over choice) ──
    if (isChoice && !isRef && !isRefType) {
      const scAlias = `sc_${field.element}`;
      joins.push(
        `LEFT JOIN ${prefix}SYS_CHOICE__VIEW ${scAlias}\n  ON ${scAlias}.NAME = '${tableName}'\n  AND ${scAlias}.ELEMENT = '${field.element}'\n  AND ${scAlias}.VALUE = ${q}${col}`
      );
      selectCols.push(`${scAlias}.LABEL AS ${col}_LABEL`);
    }
  }

  const selectBlock = selectCols.map((c) => `  ${c}`).join(",\n");
  const joinBlock = joins.length > 0 ? "\n" + joins.join("\n") : "";

  return `SELECT\n${selectBlock}\nFROM ${fullTable}${joinBlock}\nLIMIT 10;`;
}

export function QueryBuilderPanel() {
  const {
    queryBuilderFields,
    queryBuilderInstance,
    queryBuilderSnowflakeLocator,
    selectedTable,
    selectedSnapshotId,
    displayColumnCache,
    removeField,
    removeDotWalkField,
    clearQueryBuilderFields,
    setQueryBuilderInstance,
    setQueryBuilderSnowflakeLocator,
    fetchDisplayColumns,
  } = useExplorerStore();

  const [outputMode, setOutputMode] = useState<OutputMode>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Fetch display columns for referenced tables not yet in cache
  useEffect(() => {
    if (!selectedSnapshotId) return;
    const uncached = queryBuilderFields
      .filter((f) => f.referenceTable && !(f.referenceTable in displayColumnCache))
      .map((f) => f.referenceTable!);
    if (uncached.length > 0) {
      fetchDisplayColumns(selectedSnapshotId, [...new Set(uncached)]);
    }
  }, [queryBuilderFields, displayColumnCache, selectedSnapshotId, fetchDisplayColumns]);

  // Build the sysparm_fields string
  const fieldsString = useMemo(() => {
    const parts: string[] = [];
    for (const field of queryBuilderFields) {
      // If field has dot-walk children, add them as element.child
      if (field.dotWalkFields.length > 0) {
        for (const dw of field.dotWalkFields) {
          parts.push(`${field.element}.${dw.element}`);
        }
      }
      // Always include the direct field too
      parts.push(field.element);
    }
    return parts.join(",");
  }, [queryBuilderFields]);

  const instanceBase = queryBuilderInstance.trim();
  const snowflakeLocator = queryBuilderSnowflakeLocator.trim().toUpperCase();
  const hasInstance = instanceBase.length > 0;
  const hasSnowflakeLocator = snowflakeLocator.length > 0;
  const hasFields = queryBuilderFields.length > 0;

  const tableApiUrl = useMemo(() => {
    if (!hasInstance || !selectedTable) return "";
    const fieldsParam = fieldsString ? `&sysparm_fields=${encodeURIComponent(fieldsString)}` : "";
    return `https://${instanceBase}.service-now.com/api/now/table/${selectedTable}?sysparm_limit=10${fieldsParam}`;
  }, [instanceBase, selectedTable, fieldsString, hasInstance]);

  const curlCommand = useMemo(() => {
    if (!tableApiUrl) return "";
    return `curl "${tableApiUrl}" \\
  --header "Accept: application/json" \\
  --user "admin:PASSWORD"`;
  }, [tableApiUrl]);

  const queryUrl = useMemo(() => {
    if (!hasInstance || !selectedTable) return "";
    const fieldsParam = fieldsString ? `?sysparm_fields=${encodeURIComponent(fieldsString)}` : "";
    return `https://${instanceBase}.service-now.com/${selectedTable}_list.do${fieldsParam}`;
  }, [instanceBase, selectedTable, fieldsString, hasInstance]);

  const snowflakeSql = useMemo(() => {
    if (!selectedTable) return "";
    return buildSnowflakeSql(snowflakeLocator, selectedTable, queryBuilderFields, displayColumnCache);
  }, [snowflakeLocator, selectedTable, queryBuilderFields, displayColumnCache]);

  const handleCopy = useCallback(
    (text: string, label: string) => {
      navigator.clipboard.writeText(text).then(() => {
        setCopiedField(label);
        setTimeout(() => setCopiedField(null), 2000);
      });
    },
    []
  );

  if (!selectedTable) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <p className="text-xs text-muted-foreground text-center">
          Select a table to start building queries
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col text-xs">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
        <div className="flex items-center gap-1.5">
          <Terminal className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="font-semibold text-sm">Query Builder</span>
        </div>
        {hasFields && (
          <button
            onClick={clearQueryBuilderFields}
            className="text-muted-foreground hover:text-destructive transition-colors p-0.5"
            title="Clear all fields"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Connection inputs */}
      <div className="px-3 py-2 border-b space-y-2">
        {/* Instance input */}
        <div>
          <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1 block">
            Instance Name
          </label>
          <div className="flex items-center gap-1.5">
            <Server className="w-3 h-3 text-muted-foreground flex-shrink-0" />
            <input
              type="text"
              placeholder="e.g. dev12345"
              value={queryBuilderInstance}
              onChange={(e) => setQueryBuilderInstance(e.target.value)}
              className="flex-1 bg-background border rounded px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-primary/50"
            />
            <span className="text-muted-foreground text-[10px]">.service-now.com</span>
          </div>
        </div>

        {/* Snowflake locator input */}
        <div>
          <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1 block">
            Snowflake Locator
          </label>
          <div className="flex items-center gap-1.5">
            <Snowflake className="w-3 h-3 text-muted-foreground flex-shrink-0" />
            <input
              type="text"
              placeholder="e.g. MY_DB.SERVICENOW"
              value={queryBuilderSnowflakeLocator}
              onChange={(e) => setQueryBuilderSnowflakeLocator(e.target.value)}
              className="flex-1 bg-background border rounded px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-primary/50"
            />
            <span className="text-muted-foreground text-[10px]">DB.SCHEMA</span>
          </div>
        </div>
      </div>

      {/* Selected fields */}
      <div className="flex-1 overflow-auto px-3 py-2">
        {!hasFields ? (
          <div className="text-muted-foreground text-center py-4">
            <p className="mb-1">No fields selected</p>
            <p className="text-[10px]">
              Queries will return all columns. Select fields to constrain output.
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">
              Fields ({queryBuilderFields.length})
            </div>
            {queryBuilderFields.map((field) => (
              <div
                key={field.element}
                className="group"
              >
                {/* Main field */}
                <div className="flex items-center gap-1 py-0.5 px-1 rounded hover:bg-muted/50">
                  <ChevronRight className="w-2.5 h-2.5 text-muted-foreground flex-shrink-0" />
                  <span className="truncate flex-1 font-medium">
                    {field.element}
                  </span>
                  <span className="text-[10px] text-muted-foreground truncate max-w-[80px]">
                    {field.label}
                  </span>
                  <button
                    onClick={() => removeField(field.element)}
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all p-0.5"
                    title="Remove field"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>

                {/* Dot-walk children */}
                {field.dotWalkFields.length > 0 && (
                  <div className="ml-4 border-l border-emerald-300/40 pl-2">
                    {field.dotWalkFields.map((dw) => (
                      <div
                        key={dw.element}
                        className="group/dw flex items-center gap-1 py-0.5 px-1 rounded hover:bg-muted/50"
                      >
                        <span className="text-emerald-600 dark:text-emerald-400 text-[10px] flex-shrink-0">
                          .
                        </span>
                        <span className="truncate flex-1">
                          {dw.element}
                        </span>
                        <span className="text-[10px] text-muted-foreground truncate max-w-[60px]">
                          {dw.label}
                        </span>
                        <button
                          onClick={() =>
                            removeDotWalkField(field.element, dw.element)
                          }
                          className="opacity-0 group-hover/dw:opacity-100 text-muted-foreground hover:text-destructive transition-all p-0.5"
                          title="Remove dot-walk field"
                        >
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="px-3 py-2 border-t space-y-2">
        <div className="flex gap-2">
          <button
            onClick={() => setOutputMode(outputMode === "api" ? null : "api")}
            disabled={!hasInstance}
            className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded text-xs font-medium transition-colors ${
              outputMode === "api"
                ? "bg-primary text-primary-foreground"
                : "bg-muted hover:bg-muted/80 text-foreground"
            } disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            <Terminal className="w-3 h-3" />
            Generate API
          </button>
          <button
            onClick={() =>
              setOutputMode(outputMode === "query" ? null : "query")
            }
            disabled={!hasInstance}
            className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded text-xs font-medium transition-colors ${
              outputMode === "query"
                ? "bg-primary text-primary-foreground"
                : "bg-muted hover:bg-muted/80 text-foreground"
            } disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            <Globe className="w-3 h-3" />
            Query ServiceNow
          </button>
          <button
            onClick={() =>
              setOutputMode(outputMode === "snowflake" ? null : "snowflake")
            }
            className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded text-xs font-medium transition-colors ${
              outputMode === "snowflake"
                ? "bg-primary text-primary-foreground"
                : "bg-muted hover:bg-muted/80 text-foreground"
            }`}
          >
            <Snowflake className="w-3 h-3" />
            Snowflake SQL
          </button>
        </div>

        {/* Output area */}
        {outputMode === "api" && hasInstance && (
          <div className="space-y-2">
            {/* URL */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-medium text-muted-foreground uppercase">
                  URL
                </span>
                <button
                  onClick={() => handleCopy(tableApiUrl, "url")}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  title="Copy URL"
                >
                  {copiedField === "url" ? (
                    <Check className="w-3 h-3 text-emerald-500" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </button>
              </div>
              <div className="bg-muted/50 border rounded p-2 font-mono text-[10px] break-all max-h-[60px] overflow-auto select-all">
                {tableApiUrl}
              </div>
            </div>

            {/* Curl */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-medium text-muted-foreground uppercase">
                  cURL
                </span>
                <button
                  onClick={() => handleCopy(curlCommand, "curl")}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  title="Copy curl"
                >
                  {copiedField === "curl" ? (
                    <Check className="w-3 h-3 text-emerald-500" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </button>
              </div>
              <div className="bg-muted/50 border rounded p-2 font-mono text-[10px] break-all max-h-[80px] overflow-auto select-all whitespace-pre-wrap">
                {curlCommand}
              </div>
            </div>
          </div>
        )}

        {outputMode === "query" && hasInstance && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-medium text-muted-foreground uppercase">
                List URL
              </span>
              <button
                onClick={() => handleCopy(queryUrl, "query")}
                className="text-muted-foreground hover:text-foreground transition-colors"
                title="Copy query URL"
              >
                {copiedField === "query" ? (
                  <Check className="w-3 h-3 text-emerald-500" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
              </button>
            </div>
            <div className="bg-muted/50 border rounded p-2 font-mono text-[10px] break-all max-h-[60px] overflow-auto select-all">
              {queryUrl}
            </div>
          </div>
        )}

        {outputMode === "snowflake" && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-medium text-muted-foreground uppercase">
                SQL
              </span>
              <button
                onClick={() => handleCopy(snowflakeSql, "snowflake")}
                className="text-muted-foreground hover:text-foreground transition-colors"
                title="Copy SQL"
              >
                {copiedField === "snowflake" ? (
                  <Check className="w-3 h-3 text-emerald-500" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
              </button>
            </div>
            <div className="bg-muted/50 border rounded p-2 font-mono text-[10px] break-all max-h-[120px] overflow-auto select-all whitespace-pre-wrap">
              {snowflakeSql}
            </div>
            {!hasSnowflakeLocator && (
              <p className="text-[10px] text-amber-600 dark:text-amber-400 text-center mt-1">
                Enter a Snowflake locator above to fully qualify table names
              </p>
            )}
          </div>
        )}

        {!hasInstance && outputMode !== "snowflake" && outputMode !== null && (
          <p className="text-[10px] text-amber-600 dark:text-amber-400 text-center">
            Enter an instance name above to generate output
          </p>
        )}
      </div>
    </div>
  );
}
