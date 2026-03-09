import type {
  ServiceNowCredentials,
  SysDbObjectRecord,
  SysDictionaryRecord,
  SysDocumentationRecord,
  ServiceNowApiResponse,
} from "./types";

const TABLE_BATCH_SIZE = 1000;
const COLUMN_BATCH_SIZE = 5000;
const DOCUMENTATION_BATCH_SIZE = 2000;

function getDisplayValue(
  field: { display_value: string; value: string } | string | undefined | null
): string {
  if (!field) return "";
  if (typeof field === "string") return field;
  return field.display_value || field.value || "";
}

function getValue(
  field: { display_value: string; value: string } | string | undefined | null
): string {
  if (!field) return "";
  if (typeof field === "string") return field;
  return field.value || "";
}

export class ServiceNowClient {
  private baseUrl: string;
  private authHeader: string;

  constructor(credentials: ServiceNowCredentials) {
    // Extract just the origin (protocol + hostname) to handle cases where
    // users paste a full login URL instead of the base instance URL
    const parsed = new URL(credentials.url);
    this.baseUrl = parsed.origin;
    this.authHeader =
      "Basic " +
      Buffer.from(`${credentials.username}:${credentials.password}`).toString(
        "base64"
      );
  }

  private async fetchApi<T>(
    endpoint: string,
    params: Record<string, string>
  ): Promise<ServiceNowApiResponse<T>> {
    const url = new URL(`${this.baseUrl}${endpoint}`);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: this.authHeader,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(60000),
    });

    if (!response.ok) {
      throw new Error(
        `ServiceNow API error: ${response.status} ${response.statusText}`
      );
    }

    const text = await response.text();
    if (!text) {
      throw new Error("ServiceNow returned an empty response body");
    }
    try {
      return JSON.parse(text);
    } catch {
      throw new Error("ServiceNow returned invalid JSON");
    }
  }

  async getTotalCount(
    endpoint: string,
    query?: string
  ): Promise<number> {
    const url = new URL(`${this.baseUrl}${endpoint}`);
    url.searchParams.set("sysparm_limit", "1");
    if (query) url.searchParams.set("sysparm_query", query);

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: this.authHeader,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(
        `ServiceNow API error: ${response.status} ${response.statusText}`
      );
    }

    return parseInt(response.headers.get("X-Total-Count") || "0", 10);
  }

  async fetchAllTables(
    onProgress?: (current: number, total: number) => void
  ): Promise<SysDbObjectRecord[]> {
    const endpoint = "/api/now/table/sys_db_object";
    const query = "ORDERBYname";
    const fields =
      "sys_id,name,label,super_class,sys_scope,is_extendable,accessible_from,number_ref";

    const total = await this.getTotalCount(endpoint, query);
    const allRecords: SysDbObjectRecord[] = [];
    let offset = 0;

    while (offset < total) {
      const response = await this.fetchApi<SysDbObjectRecord>(endpoint, {
        sysparm_fields: fields,
        sysparm_query: query,
        sysparm_limit: String(TABLE_BATCH_SIZE),
        sysparm_offset: String(offset),
        sysparm_display_value: "all",
      });

      allRecords.push(...response.result);
      offset += TABLE_BATCH_SIZE;
      onProgress?.(Math.min(offset, total), total);
    }

    return allRecords;
  }

  async fetchAllColumns(
    onProgress?: (current: number, total: number) => void
  ): Promise<SysDictionaryRecord[]> {
    const endpoint = "/api/now/table/sys_dictionary";
    const query = "elementISNOTEMPTY^ORDERBYname^ORDERBYelement";
    const fields =
      "sys_id,name,element,column_label,internal_type,max_length,mandatory,read_only,active,reference,default_value,display,primary";

    const total = await this.getTotalCount(endpoint, query);
    const allRecords: SysDictionaryRecord[] = [];
    let offset = 0;

    while (offset < total) {
      const response = await this.fetchApi<SysDictionaryRecord>(endpoint, {
        sysparm_fields: fields,
        sysparm_query: query,
        sysparm_limit: String(COLUMN_BATCH_SIZE),
        sysparm_offset: String(offset),
        sysparm_display_value: "all",
      });

      allRecords.push(...response.result);
      offset += COLUMN_BATCH_SIZE;
      onProgress?.(Math.min(offset, total), total);
    }

    return allRecords;
  }

  async fetchDocumentation(
    onProgress?: (current: number, total: number) => void
  ): Promise<SysDocumentationRecord[]> {
    const endpoint = "/api/now/table/sys_documentation";
    const query = "elementISNOTEMPTY^hintISNOTEMPTY^ORDERBYname^ORDERBYelement";
    const fields = "sys_id,name,element,hint,help,label";

    const total = await this.getTotalCount(endpoint, query);
    const allRecords: SysDocumentationRecord[] = [];
    let offset = 0;

    while (offset < total) {
      const response = await this.fetchApi<SysDocumentationRecord>(endpoint, {
        sysparm_fields: fields,
        sysparm_query: query,
        sysparm_limit: String(DOCUMENTATION_BATCH_SIZE),
        sysparm_offset: String(offset),
        sysparm_display_value: "all",
      });

      allRecords.push(...response.result);
      offset += DOCUMENTATION_BATCH_SIZE;
      onProgress?.(Math.min(offset, total), total);
    }

    return allRecords;
  }

  /**
   * Lightweight fetch of reference field mappings from sys_dictionary.
   * Returns an array of { tableName, element, refSysId, refLabel } for
   * every column that has a non-empty reference target.
   */
  async fetchReferenceFields(): Promise<
    { tableName: string; element: string; refSysId: string; refLabel: string }[]
  > {
    const endpoint = "/api/now/table/sys_dictionary";
    const query =
      "internal_type=reference^elementISNOTEMPTY^referenceISNOTEMPTY";
    const fields = "name,element,reference";

    const total = await this.getTotalCount(endpoint, query);

    type RefRecord = {
      name: { value: string; display_value: string } | string;
      element: { value: string; display_value: string } | string;
      reference: { value: string; display_value: string } | string;
    };

    const results: {
      tableName: string;
      element: string;
      refSysId: string;
      refLabel: string;
    }[] = [];
    let offset = 0;

    while (offset < total) {
      const response = await this.fetchApi<RefRecord>(endpoint, {
        sysparm_fields: fields,
        sysparm_query: query,
        sysparm_limit: String(COLUMN_BATCH_SIZE),
        sysparm_offset: String(offset),
        sysparm_display_value: "all",
      });

      for (const rec of response.result) {
        const tableName = getValue(rec.name);
        const element = getValue(rec.element);
        const refSysId = getValue(rec.reference);
        const refLabel = getDisplayValue(rec.reference);
        if (tableName && element && (refSysId || refLabel)) {
          results.push({ tableName, element, refSysId, refLabel });
        }
      }

      offset += COLUMN_BATCH_SIZE;
    }

    return results;
  }

  /**
   * Tests connectivity by fetching a count of sys_db_object records.
   * Returns the table count on success, or throws with a descriptive error.
   */
  async testConnection(): Promise<{ success: true; tableCount: number }> {
    const endpoint = "/api/now/table/sys_db_object";
    const url = new URL(`${this.baseUrl}${endpoint}`);
    url.searchParams.set("sysparm_limit", "1");

    let response: Response;
    try {
      response = await fetch(url.toString(), {
        headers: {
          Authorization: this.authHeader,
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(15000), // 15s timeout
      });
    } catch (err) {
      if (err instanceof Error && err.name === "TimeoutError") {
        throw new Error(
          `Connection timed out. Verify the instance URL (${this.baseUrl}) is correct and accessible.`
        );
      }
      throw new Error(
        `Cannot reach ${this.baseUrl}. Check that the URL is correct and the instance is online.`
      );
    }

    if (response.status === 401 || response.status === 403) {
      throw new Error(
        "Authentication failed. Check that the username and password are correct and the user has API access."
      );
    }

    if (!response.ok) {
      throw new Error(
        `ServiceNow returned an error: ${response.status} ${response.statusText}`
      );
    }

    // Check that we got a valid JSON response with results
    let body: { result?: unknown[] };
    try {
      body = await response.json();
    } catch {
      throw new Error(
        "Unexpected response from ServiceNow. The URL may not point to a valid ServiceNow instance."
      );
    }

    if (!body.result || !Array.isArray(body.result)) {
      throw new Error(
        "Unexpected response format. The URL may not point to a valid ServiceNow instance."
      );
    }

    const tableCount = parseInt(
      response.headers.get("X-Total-Count") || "0",
      10
    );
    return { success: true, tableCount };
  }

  static parseTableRecord(record: SysDbObjectRecord) {
    // With sysparm_display_value=all, ALL fields come as { display_value, value } objects
    const sysId = getValue(record.sys_id);
    const name = getValue(record.name);
    return {
      sysId,
      name,
      label: getDisplayValue(record.label) || name,
      // super_class is a reference field: value = sys_id of parent, display_value = label
      // We store the sys_id here and resolve to table name after all tables are parsed
      superClassSysId: getValue(record.super_class) || null,
      superClassName: null as string | null, // resolved post-parse via sysId lookup
      scopeName: getValue(record.sys_scope) || null,
      scopeLabel: getDisplayValue(record.sys_scope) || null,
      isExtendable: getValue(record.is_extendable) === "true",
      accessibleFrom: getValue(record.accessible_from) || null,
      numberPrefix: getDisplayValue(record.number_ref) || null,
    };
  }

  static parseDocumentationRecord(record: SysDocumentationRecord) {
    return {
      tableName: getValue(record.name),
      element: getValue(record.element),
      hint: getValue(record.hint),
      help: getValue(record.help),
      label: getDisplayValue(record.label),
    };
  }

  static parseColumnRecord(record: SysDictionaryRecord) {
    // With sysparm_display_value=all, ALL fields come as { display_value, value } objects
    const element = getValue(record.element);
    return {
      sysId: getValue(record.sys_id),
      element,
      label: getDisplayValue(record.column_label) || element,
      definedOnTable: getValue(record.name),
      internalType: getDisplayValue(record.internal_type) || "string",
      // reference is a reference field to sys_db_object: value = sys_id of target table
      // display_value = table label (e.g. "User"). We store both for fallback resolution.
      referenceTableSysId: getValue(record.reference) || null,
      referenceTableLabel: getDisplayValue(record.reference) || null,
      referenceTable: null as string | null, // resolved post-parse via sysId lookup
      maxLength: getValue(record.max_length) ? parseInt(getValue(record.max_length), 10) : null,
      isMandatory: getValue(record.mandatory) === "true",
      isReadOnly: getValue(record.read_only) === "true",
      isActive: getValue(record.active) !== "false",
      isDisplay: getValue(record.display) === "true",
      isPrimary: getValue(record.primary) === "true",
      defaultValue: getValue(record.default_value) || null,
    };
  }
}
