import { describe, it, expect } from "vitest";
import {
  buildReferenceLookups,
  resolveReferenceTable,
  validateReferenceTable,
  type TableInfo,
} from "@/lib/servicenow/resolve-references";

// ---------------------------------------------------------------------------
// Test data — realistic ServiceNow table entries
// ---------------------------------------------------------------------------
const tables: TableInfo[] = [
  { name: "sys_user", label: "User", sysId: "abc111" },
  { name: "sys_user_group", label: "Group", sysId: "abc222" },
  { name: "cmdb_ci", label: "Configuration Item", sysId: "abc333" },
  { name: "cmdb_ci_computer", label: "Computer", sysId: "abc444" },
  { name: "imp_user", label: "Import User", sysId: "abc555" },
  { name: "incident", label: "Incident", sysId: "abc666" },
  { name: "task", label: "Task", sysId: "abc777" },
];

describe("buildReferenceLookups", () => {
  it("builds all lookup maps from table data", () => {
    const lookups = buildReferenceLookups(tables);

    expect(lookups.tableNameSet.size).toBe(7);
    expect(lookups.tableNameSet.has("sys_user")).toBe(true);
    expect(lookups.sysIdToName.get("abc111")).toBe("sys_user");
    expect(lookups.labelToName.get("User")).toBe("sys_user");
    expect(lookups.lowerLabelToName.get("user")).toBe("sys_user");
  });

  it("first label wins for duplicate labels", () => {
    const tablesWithDupes: TableInfo[] = [
      { name: "table_a", label: "Shared Label", sysId: "s1" },
      { name: "table_b", label: "Shared Label", sysId: "s2" },
    ];
    const lookups = buildReferenceLookups(tablesWithDupes);

    expect(lookups.labelToName.get("Shared Label")).toBe("table_a");
  });
});

describe("resolveReferenceTable", () => {
  const lookups = buildReferenceLookups(tables);

  describe("Step 1: Direct table name match", () => {
    it("resolves when value IS a known table name", () => {
      const result = resolveReferenceTable("sys_user", null, lookups);
      expect(result).toEqual({ resolvedName: "sys_user", resolvedBy: "name" });
    });

    it("resolves exact table name even when label also matches", () => {
      const result = resolveReferenceTable("incident", "Incident", lookups);
      expect(result).toEqual({ resolvedName: "incident", resolvedBy: "name" });
    });
  });

  describe("Step 2: sys_id lookup", () => {
    it("resolves when value is a sys_db_object sys_id", () => {
      const result = resolveReferenceTable("abc333", null, lookups);
      expect(result).toEqual({ resolvedName: "cmdb_ci", resolvedBy: "sysId" });
    });

    it("prefers name match over sys_id match", () => {
      // If the value happens to be both a table name and a sys_id (unlikely but possible)
      const result = resolveReferenceTable("sys_user", null, lookups);
      expect(result.resolvedBy).toBe("name");
    });
  });

  describe("Step 3: Label lookup (exact match)", () => {
    it("resolves by exact label when value is not a name or sys_id", () => {
      const result = resolveReferenceTable("unknown_id", "User", lookups);
      expect(result).toEqual({ resolvedName: "sys_user", resolvedBy: "label" });
    });

    it("resolves by exact label with multi-word labels", () => {
      const result = resolveReferenceTable(
        "unknown_id",
        "Configuration Item",
        lookups
      );
      expect(result).toEqual({ resolvedName: "cmdb_ci", resolvedBy: "label" });
    });
  });

  describe("Step 4: Case-insensitive label match (the bug that bit us)", () => {
    it("resolves lowercase 'user' → sys_user via label CI", () => {
      const result = resolveReferenceTable("unknown_id", "user", lookups);
      expect(result).toEqual({
        resolvedName: "sys_user",
        resolvedBy: "labelCI",
      });
    });

    it("resolves UPPERCASE 'USER' → sys_user via label CI", () => {
      const result = resolveReferenceTable("unknown_id", "USER", lookups);
      expect(result).toEqual({
        resolvedName: "sys_user",
        resolvedBy: "labelCI",
      });
    });

    it("resolves mixed case 'configuration item' → cmdb_ci", () => {
      const result = resolveReferenceTable(
        "unknown_id",
        "configuration item",
        lookups
      );
      expect(result).toEqual({
        resolvedName: "cmdb_ci",
        resolvedBy: "labelCI",
      });
    });
  });

  describe("Label collision prevention", () => {
    it("does NOT collide imp_user with sys_user via label match", () => {
      // "Import User" label should resolve to imp_user, not sys_user
      const result = resolveReferenceTable(
        "unknown_id",
        "Import User",
        lookups
      );
      expect(result).toEqual({
        resolvedName: "imp_user",
        resolvedBy: "label",
      });
    });

    it("does NOT collide 'import user' (lowercase) with 'user'", () => {
      const result = resolveReferenceTable(
        "unknown_id",
        "import user",
        lookups
      );
      expect(result).toEqual({
        resolvedName: "imp_user",
        resolvedBy: "labelCI",
      });
    });
  });

  describe("Unresolvable references", () => {
    it("returns null for completely unknown value and label", () => {
      const result = resolveReferenceTable(
        "totally_unknown",
        "Nonexistent Table",
        lookups
      );
      expect(result).toEqual({ resolvedName: null, resolvedBy: null });
    });

    it("returns null when value is unknown and label is null", () => {
      const result = resolveReferenceTable("totally_unknown", null, lookups);
      expect(result).toEqual({ resolvedName: null, resolvedBy: null });
    });

    it("returns null when value is unknown and label is empty", () => {
      const result = resolveReferenceTable("totally_unknown", "", lookups);
      expect(result).toEqual({ resolvedName: null, resolvedBy: null });
    });
  });

  describe("Priority order", () => {
    it("name match takes priority over sys_id", () => {
      // Create a scenario where a value could match both
      const specialTables: TableInfo[] = [
        { name: "abc111", label: "Special", sysId: "xyz999" }, // table named "abc111"
        { name: "sys_user", label: "User", sysId: "abc111" }, // sys_id "abc111"
      ];
      const specialLookups = buildReferenceLookups(specialTables);
      const result = resolveReferenceTable("abc111", null, specialLookups);
      // Should resolve by name to "abc111" (the table), not by sys_id to "sys_user"
      expect(result.resolvedBy).toBe("name");
      expect(result.resolvedName).toBe("abc111");
    });

    it("sys_id takes priority over label", () => {
      const result = resolveReferenceTable("abc111", "Computer", lookups);
      // abc111 is sys_user's sys_id — should resolve by sys_id, not by label "Computer"
      expect(result).toEqual({
        resolvedName: "sys_user",
        resolvedBy: "sysId",
      });
    });
  });
});

describe("validateReferenceTable", () => {
  const lookups = buildReferenceLookups(tables);

  it("returns valid for known table names", () => {
    const result = validateReferenceTable("sys_user", lookups);
    expect(result).toEqual({
      valid: true,
      suggestedName: null,
      resolvedBy: null,
    });
  });

  it("detects stale label and suggests correction", () => {
    const result = validateReferenceTable("User", lookups);
    expect(result).toEqual({
      valid: false,
      suggestedName: "sys_user",
      resolvedBy: "label",
    });
  });

  it("detects stale case-insensitive label", () => {
    const result = validateReferenceTable("user", lookups);
    expect(result).toEqual({
      valid: false,
      suggestedName: "sys_user",
      resolvedBy: "labelCI",
    });
  });

  it("returns unresolvable for unknown values", () => {
    const result = validateReferenceTable("nonexistent", lookups);
    expect(result).toEqual({
      valid: false,
      suggestedName: null,
      resolvedBy: null,
    });
  });
});
