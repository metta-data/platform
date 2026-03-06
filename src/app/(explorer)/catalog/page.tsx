"use client";

import { useEffect, useState, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { TYPE_COLORS } from "@/lib/constants";

interface CatalogEntrySummary {
  id: string;
  tableName: string;
  element: string;
  label: string;
  internalType: string;
  definition: string | null;
  definitionSource: string | null;
  validationStatus: string;
  steward: { id: string; username: string; displayName: string | null } | null;
  createdAt: string;
  updatedAt: string;
}

interface CatalogEntryDetail {
  entry: CatalogEntrySummary & {
    definitionSourceDetail: string | null;
    validatedAt: string | null;
    validatedBy: {
      id: string;
      username: string;
      displayName: string | null;
    } | null;
  };
  sourceSnapshot: { id: string; label: string; createdAt: string };
  linkedSnapshots: {
    id: string;
    label: string;
    linkedAt: string;
    createdAt: string;
  }[];
  inheritingTables: string[];
  auditHistory: {
    id: string;
    fieldName: string;
    oldValue: string | null;
    newValue: string | null;
    comment: string | null;
    user: { id: string; username: string; displayName: string | null } | null;
    createdAt: string;
  }[];
}

interface CatalogStats {
  totalEntries: number;
  definedCount: number;
  undefinedCount: number;
  stewardedCount: number;
  tableCount: number;
  validatedCount: number;
  draftWithDefinitionCount: number;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const SOURCE_LABELS: Record<string, string> = {
  MANUAL: "Manual",
  SYS_DOCUMENTATION: "sys_documentation",
  EXCEL_UPLOAD: "Excel",
};

export default function CatalogPage() {
  const [entries, setEntries] = useState<CatalogEntrySummary[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [stats, setStats] = useState<CatalogStats | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [tableFilter, setTableFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [definedFilter, setDefinedFilter] = useState<string>("");
  const [validatedFilter, setValidatedFilter] = useState<string>("");
  const [sourceFilter, setSourceFilter] = useState<string>("");
  const [page, setPage] = useState(1);

  // Detail sheet
  const [selectedEntry, setSelectedEntry] =
    useState<CatalogEntrySummary | null>(null);
  const [detail, setDetail] = useState<CatalogEntryDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Edit state
  const [editing, setEditing] = useState(false);
  const [editDefinition, setEditDefinition] = useState("");
  const [saving, setSaving] = useState(false);

  // Bulk selection state
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());
  const [bulkValidating, setBulkValidating] = useState(false);
  const [bulkAssigning, setBulkAssigning] = useState(false);

  // Distinct table names and types for filter dropdowns
  const [tableNames, setTableNames] = useState<string[]>([]);
  const [fieldTypes, setFieldTypes] = useState<string[]>([]);

  // Fetch user session to determine edit permissions
  const [canEdit, setCanEdit] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((session) => {
        const role = session?.user?.role;
        setUserRole(role || null);
        setCanEdit(role === "STEWARD" || role === "ADMIN");
        setCurrentUserId(session?.user?.userId || null);
      })
      .catch(() => {
        setCanEdit(false);
        setUserRole(null);
        setCurrentUserId(null);
      });
  }, []);

  // Fetch stats
  const refreshStats = useCallback(() => {
    fetch("/api/catalog/stats")
      .then((r) => r.json())
      .then(setStats)
      .catch(console.error);
  }, []);

  useEffect(() => {
    refreshStats();
  }, [refreshStats]);

  // Fetch entries
  const fetchEntries = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (tableFilter) params.set("table", tableFilter);
    if (typeFilter) params.set("type", typeFilter);
    if (definedFilter) params.set("defined", definedFilter);
    if (validatedFilter) params.set("validated", validatedFilter);
    if (sourceFilter) params.set("source", sourceFilter);
    params.set("page", String(page));
    params.set("limit", "50");

    fetch(`/api/catalog?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setEntries(data.entries);
        setPagination(data.pagination);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [search, tableFilter, typeFilter, definedFilter, validatedFilter, sourceFilter, page]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  // Build filter options from loaded entries (progressive)
  useEffect(() => {
    if (entries.length > 0) {
      setTableNames((prev) => {
        const all = new Set([...prev, ...entries.map((e) => e.tableName)]);
        return Array.from(all).sort();
      });
      setFieldTypes((prev) => {
        const all = new Set([...prev, ...entries.map((e) => e.internalType)]);
        return Array.from(all).sort();
      });
    }
  }, [entries]);

  // Fetch detail when an entry is selected
  const openDetail = (entry: CatalogEntrySummary) => {
    setSelectedEntry(entry);
    setSheetOpen(true);
    setEditing(false);
    setDetailLoading(true);
    setDetail(null);

    fetch(
      `/api/catalog/${encodeURIComponent(entry.tableName)}/${encodeURIComponent(entry.element)}`
    )
      .then((r) => r.json())
      .then(setDetail)
      .catch(console.error)
      .finally(() => setDetailLoading(false));
  };

  const handleSaveDefinition = async () => {
    if (!selectedEntry) return;
    setSaving(true);
    try {
      const res = await fetch(
        `/api/catalog/${encodeURIComponent(selectedEntry.tableName)}/${encodeURIComponent(selectedEntry.element)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ definition: editDefinition }),
        }
      );
      if (!res.ok) throw new Error("Failed to save");
      const updated = await res.json();

      // Update local state
      setDetail((prev) =>
        prev
          ? {
              ...prev,
              entry: {
                ...prev.entry,
                definition: updated.definition,
                definitionSource: updated.definitionSource,
                validationStatus: updated.validationStatus,
              },
            }
          : prev
      );
      setEntries((prev) =>
        prev.map((e) =>
          e.id === selectedEntry.id
            ? {
                ...e,
                definition: updated.definition,
                definitionSource: updated.definitionSource,
                validationStatus: updated.validationStatus,
              }
            : e
        )
      );
      setEditing(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  // Single-entry validate/unvalidate
  const handleToggleValidation = async () => {
    if (!selectedEntry || !detail) return;
    const newStatus =
      detail.entry.validationStatus === "VALIDATED" ? "unvalidate" : "validate";

    try {
      const res = await fetch("/api/catalog/validate", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entryIds: [selectedEntry.id],
          action: newStatus,
        }),
      });
      if (!res.ok) throw new Error("Failed to update validation");

      // Refresh detail
      const detailRes = await fetch(
        `/api/catalog/${encodeURIComponent(selectedEntry.tableName)}/${encodeURIComponent(selectedEntry.element)}`
      );
      const freshDetail = await detailRes.json();
      setDetail(freshDetail);

      // Update list
      setEntries((prev) =>
        prev.map((e) =>
          e.id === selectedEntry.id
            ? {
                ...e,
                validationStatus:
                  newStatus === "validate" ? "VALIDATED" : "DRAFT",
              }
            : e
        )
      );
      refreshStats();
    } catch (err) {
      console.error(err);
    }
  };

  // Bulk validate/unvalidate
  const handleBulkValidation = async (action: "validate" | "unvalidate") => {
    if (bulkSelected.size === 0) return;
    setBulkValidating(true);
    try {
      const res = await fetch("/api/catalog/validate", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entryIds: Array.from(bulkSelected),
          action,
        }),
      });
      if (!res.ok) throw new Error("Failed to update validation");
      const data = await res.json();

      // Refresh entries and stats
      fetchEntries();
      refreshStats();
      setBulkSelected(new Set());

      // Show a brief notification via console
      console.log(`${data.updated} entries ${action}d`);
    } catch (err) {
      console.error(err);
    } finally {
      setBulkValidating(false);
    }
  };

  // Bulk assign steward (selected entries)
  const handleBulkAssignSteward = async () => {
    if (bulkSelected.size === 0 || !currentUserId) return;
    setBulkAssigning(true);
    try {
      const res = await fetch("/api/catalog/steward", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entryIds: Array.from(bulkSelected),
          stewardId: currentUserId,
        }),
      });
      if (!res.ok) throw new Error("Failed to assign steward");

      fetchEntries();
      refreshStats();
      setBulkSelected(new Set());
    } catch (err) {
      console.error(err);
    } finally {
      setBulkAssigning(false);
    }
  };

  // Bulk assign steward to ALL entries matching current filters
  const handleAssignStewardAll = async () => {
    if (!currentUserId) return;
    const count = pagination?.total || 0;
    if (!confirm(`Assign yourself as steward to all ${count.toLocaleString()} matching entries?`)) return;
    setBulkAssigning(true);
    try {
      const filters: Record<string, string> = {};
      if (search) filters.search = search;
      if (tableFilter) filters.table = tableFilter;
      if (typeFilter) filters.type = typeFilter;
      if (definedFilter) filters.defined = definedFilter;
      if (validatedFilter) filters.validated = validatedFilter;
      if (sourceFilter) filters.source = sourceFilter;

      const res = await fetch("/api/catalog/steward", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filters,
          stewardId: currentUserId,
        }),
      });
      if (!res.ok) throw new Error("Failed to assign steward");
      const data = await res.json();

      fetchEntries();
      refreshStats();
      setBulkSelected(new Set());
      console.log(`${data.updated} entries assigned`);
    } catch (err) {
      console.error(err);
    } finally {
      setBulkAssigning(false);
    }
  };

  // Toggle bulk selection
  const toggleBulkSelect = (id: string) => {
    setBulkSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAllVisible = () => {
    const visibleIds = entries.map((e) => e.id);
    const allSelected = visibleIds.every((id) => bulkSelected.has(id));
    if (allSelected) {
      setBulkSelected((prev) => {
        const next = new Set(prev);
        visibleIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setBulkSelected((prev) => {
        const next = new Set(prev);
        visibleIds.forEach((id) => next.add(id));
        return next;
      });
    }
  };

  // Search debounce
  const [searchInput, setSearchInput] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const validationBadge = (entry: CatalogEntrySummary) => {
    if (!entry.definition) return null;
    if (entry.validationStatus === "VALIDATED") {
      return (
        <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-[10px]">
          Validated
        </Badge>
      );
    }
    return (
      <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 text-[10px]">
        Draft
      </Badge>
    );
  };

  const sourceLabel = (source: string | null) => {
    if (!source) return null;
    return (
      <span className="text-[10px] text-muted-foreground">
        via {SOURCE_LABELS[source] || source}
      </span>
    );
  };

  return (
    <div className="p-6 max-w-7xl mx-auto overflow-auto h-full">
      <h1 className="text-2xl font-bold mb-4">Data Catalog</h1>

      {/* Stats bar */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
          <Card>
            <CardContent className="py-3 px-4">
              <div className="text-2xl font-bold">{stats.totalEntries}</div>
              <div className="text-xs text-muted-foreground">Total Fields</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-3 px-4">
              <div className="text-2xl font-bold text-green-600">
                {stats.definedCount}
              </div>
              <div className="text-xs text-muted-foreground">Defined</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-3 px-4">
              <div className="text-2xl font-bold text-amber-600">
                {stats.undefinedCount}
              </div>
              <div className="text-xs text-muted-foreground">
                Needs Definition
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-3 px-4">
              <div className="text-2xl font-bold text-blue-600">
                {stats.validatedCount}
              </div>
              <div className="text-xs text-muted-foreground">Validated</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-3 px-4">
              <div className="text-2xl font-bold">{stats.stewardedCount}</div>
              <div className="text-xs text-muted-foreground">Has Steward</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-3 px-4">
              <div className="text-2xl font-bold">{stats.tableCount}</div>
              <div className="text-xs text-muted-foreground">Tables</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <Input
          placeholder="Search fields..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="w-64"
        />
        <Select
          value={tableFilter}
          onValueChange={(v) => {
            setTableFilter(v === "__all__" ? "" : v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All tables" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All tables</SelectItem>
            {tableNames.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={typeFilter}
          onValueChange={(v) => {
            setTypeFilter(v === "__all__" ? "" : v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All types</SelectItem>
            {fieldTypes.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={definedFilter}
          onValueChange={(v) => {
            setDefinedFilter(v === "__all__" ? "" : v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All definitions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All definitions</SelectItem>
            <SelectItem value="true">Has definition</SelectItem>
            <SelectItem value="false">Needs definition</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={validatedFilter}
          onValueChange={(v) => {
            setValidatedFilter(v === "__all__" ? "" : v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All status</SelectItem>
            <SelectItem value="true">Validated</SelectItem>
            <SelectItem value="false">Draft</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={sourceFilter}
          onValueChange={(v) => {
            setSourceFilter(v === "__all__" ? "" : v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All sources" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All sources</SelectItem>
            <SelectItem value="MANUAL">Manual</SelectItem>
            <SelectItem value="SYS_DOCUMENTATION">sys_documentation</SelectItem>
            <SelectItem value="EXCEL_UPLOAD">Excel upload</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Bulk action bar */}
      {bulkSelected.size > 0 && canEdit && (
        <div className="flex items-center gap-3 mb-4 p-3 rounded-lg border bg-accent/30">
          <span className="text-sm font-medium">
            {bulkSelected.size} selected
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={bulkValidating}
            onClick={() => handleBulkValidation("validate")}
          >
            Validate selected
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={bulkValidating}
            onClick={() => handleBulkValidation("unvalidate")}
          >
            Unvalidate selected
          </Button>
          {currentUserId && (
            <Button
              size="sm"
              variant="outline"
              disabled={bulkAssigning}
              onClick={handleBulkAssignSteward}
            >
              {bulkAssigning ? "Assigning..." : "Assign me as steward"}
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setBulkSelected(new Set())}
          >
            Clear selection
          </Button>
        </div>
      )}

      {/* Bulk assign steward to all matching */}
      {canEdit && currentUserId && pagination && pagination.total > 0 && (
        <div className="flex items-center gap-3 mb-4 p-3 rounded-lg border bg-muted/50">
          <span className="text-sm text-muted-foreground">
            {pagination.total.toLocaleString()} entries match current filters
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={bulkAssigning}
            onClick={handleAssignStewardAll}
          >
            {bulkAssigning ? "Assigning..." : "Assign me as steward to all"}
          </Button>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            {stats?.totalEntries === 0
              ? "No catalog entries yet. An admin can generate the catalog from a schema snapshot."
              : "No entries match your filters."}
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  {canEdit && (
                    <TableHead className="w-10">
                      <input
                        type="checkbox"
                        checked={
                          entries.length > 0 &&
                          entries.every((e) => bulkSelected.has(e.id))
                        }
                        onChange={toggleSelectAllVisible}
                        className="rounded"
                      />
                    </TableHead>
                  )}
                  <TableHead>Table</TableHead>
                  <TableHead>Field</TableHead>
                  <TableHead>Label</TableHead>
                  <TableHead className="w-[120px]">Type</TableHead>
                  <TableHead>Definition</TableHead>
                  <TableHead className="w-[80px]">Status</TableHead>
                  <TableHead>Steward</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow
                    key={entry.id}
                    className="cursor-pointer hover:bg-accent/50"
                    onClick={() => openDetail(entry)}
                  >
                    {canEdit && (
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={bulkSelected.has(entry.id)}
                          onChange={() => toggleBulkSelect(entry.id)}
                          className="rounded"
                        />
                      </TableCell>
                    )}
                    <TableCell className="font-mono text-sm">
                      {entry.tableName}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {entry.element}
                    </TableCell>
                    <TableCell className="text-sm">{entry.label}</TableCell>
                    <TableCell>
                      <Badge
                        className={`text-[10px] ${TYPE_COLORS[entry.internalType] || ""}`}
                        variant="secondary"
                      >
                        {entry.internalType}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm max-w-[200px]">
                      <div className="truncate text-muted-foreground">
                        {entry.definition || (
                          <span className="italic text-muted-foreground/50">
                            No definition
                          </span>
                        )}
                      </div>
                      {entry.definitionSource &&
                        sourceLabel(entry.definitionSource)}
                    </TableCell>
                    <TableCell>{validationBadge(entry)}</TableCell>
                    <TableCell className="text-sm">
                      {entry.steward?.displayName ||
                        entry.steward?.username ||
                        "\u2014"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <span className="text-sm text-muted-foreground">
                Showing {(pagination.page - 1) * pagination.limit + 1}&ndash;
                {Math.min(
                  pagination.page * pagination.limit,
                  pagination.total
                )}{" "}
                of {pagination.total}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= pagination.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Detail Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-[500px] sm:max-w-[500px] overflow-y-auto">
          {selectedEntry && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-base">
                    {selectedEntry.tableName}.{selectedEntry.element}
                  </span>
                  <Badge
                    className={`text-[10px] ${TYPE_COLORS[selectedEntry.internalType] || ""}`}
                    variant="secondary"
                  >
                    {selectedEntry.internalType}
                  </Badge>
                </SheetTitle>
                <p className="text-sm text-muted-foreground">
                  {selectedEntry.label}
                </p>
              </SheetHeader>

              {detailLoading ? (
                <div className="space-y-4 mt-6">
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                </div>
              ) : detail ? (
                <Tabs defaultValue="definition" className="mt-6">
                  <TabsList className="w-full">
                    <TabsTrigger value="definition" className="flex-1">
                      Definition
                    </TabsTrigger>
                    <TabsTrigger value="inheritance" className="flex-1">
                      Inheritance
                    </TabsTrigger>
                    <TabsTrigger value="snapshots" className="flex-1">
                      Snapshots
                    </TabsTrigger>
                    <TabsTrigger value="history" className="flex-1">
                      History
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="definition" className="space-y-4">
                    {/* Validation badge & action */}
                    {detail.entry.definition && (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {detail.entry.validationStatus === "VALIDATED" ? (
                            <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                              Validated
                            </Badge>
                          ) : (
                            <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                              Draft
                            </Badge>
                          )}
                          {detail.entry.validatedAt &&
                            detail.entry.validatedBy && (
                              <span className="text-xs text-muted-foreground">
                                by{" "}
                                {detail.entry.validatedBy.displayName ||
                                  detail.entry.validatedBy.username}{" "}
                                on{" "}
                                {new Date(
                                  detail.entry.validatedAt
                                ).toLocaleDateString()}
                              </span>
                            )}
                        </div>
                        {canEdit && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleToggleValidation}
                          >
                            {detail.entry.validationStatus === "VALIDATED"
                              ? "Unvalidate"
                              : "Validate"}
                          </Button>
                        )}
                      </div>
                    )}

                    {editing ? (
                      <div className="space-y-3">
                        <label className="text-sm font-medium">
                          Definition
                        </label>
                        <textarea
                          className="w-full min-h-[120px] rounded-md border bg-background px-3 py-2 text-sm"
                          value={editDefinition}
                          onChange={(e) => setEditDefinition(e.target.value)}
                          placeholder="Enter a definition for this field..."
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={handleSaveDefinition}
                            disabled={saving}
                          >
                            {saving ? "Saving..." : "Save"}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditing(false)}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">
                            Definition
                          </span>
                          {canEdit && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setEditDefinition(
                                  detail.entry.definition || ""
                                );
                                setEditing(true);
                              }}
                            >
                              Edit
                            </Button>
                          )}
                        </div>
                        <p className="text-sm whitespace-pre-wrap">
                          {detail.entry.definition || (
                            <span className="italic text-muted-foreground">
                              No definition yet
                            </span>
                          )}
                        </p>
                        {detail.entry.definitionSource && (
                          <p className="text-xs text-muted-foreground mt-2">
                            Source:{" "}
                            {SOURCE_LABELS[detail.entry.definitionSource] ||
                              detail.entry.definitionSource}
                            {detail.entry.definitionSourceDetail && (
                              <span className="ml-1">
                                ({detail.entry.definitionSourceDetail})
                              </span>
                            )}
                          </p>
                        )}
                      </div>
                    )}

                    {detail.entry.steward && (
                      <div>
                        <span className="text-sm font-medium">Steward</span>
                        <p className="text-sm text-muted-foreground">
                          {detail.entry.steward.displayName ||
                            detail.entry.steward.username}
                        </p>
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="inheritance" className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Defined on{" "}
                      <span className="font-mono font-medium text-foreground">
                        {detail.entry.tableName}
                      </span>
                      . Inherited by {detail.inheritingTables.length} table
                      {detail.inheritingTables.length !== 1 ? "s" : ""}.
                    </p>
                    {detail.inheritingTables.length > 0 ? (
                      <div className="space-y-1 max-h-[400px] overflow-y-auto">
                        {detail.inheritingTables.map((table) => (
                          <div
                            key={table}
                            className="text-sm font-mono py-1 px-2 rounded hover:bg-accent/50"
                          >
                            {table}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">
                        No inheriting tables found.
                      </p>
                    )}
                  </TabsContent>

                  <TabsContent value="snapshots" className="space-y-3">
                    {/* Source snapshot */}
                    <div>
                      <span className="text-sm font-medium">
                        First established by
                      </span>
                      <div className="mt-1 p-2 rounded-md bg-accent/30 text-sm">
                        <span className="font-medium">
                          {detail.sourceSnapshot.label}
                        </span>
                        <span className="text-muted-foreground ml-2">
                          {new Date(
                            detail.sourceSnapshot.createdAt
                          ).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    {/* Subsequent snapshots */}
                    {detail.linkedSnapshots.length > 1 && (
                      <div>
                        <span className="text-sm font-medium">
                          Also found in
                        </span>
                        <div className="space-y-1 mt-1">
                          {detail.linkedSnapshots
                            .filter(
                              (s) => s.id !== detail.sourceSnapshot.id
                            )
                            .map((snap) => (
                              <div
                                key={snap.id}
                                className="text-sm py-1 px-2 rounded hover:bg-accent/50"
                              >
                                <span>{snap.label}</span>
                                <span className="text-muted-foreground ml-2">
                                  linked{" "}
                                  {new Date(
                                    snap.linkedAt
                                  ).toLocaleDateString()}
                                </span>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}

                    {detail.linkedSnapshots.length <= 1 && (
                      <p className="text-sm text-muted-foreground italic">
                        Only found in the source snapshot so far.
                      </p>
                    )}
                  </TabsContent>

                  <TabsContent value="history" className="space-y-3">
                    {detail.auditHistory && detail.auditHistory.length > 0 ? (
                      <div className="space-y-3 max-h-[400px] overflow-y-auto">
                        {detail.auditHistory.map((audit) => (
                          <div
                            key={audit.id}
                            className="p-3 rounded-md border text-sm space-y-1"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-medium">
                                {audit.user
                                  ? audit.user.displayName ||
                                    audit.user.username
                                  : "System"}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {new Date(audit.createdAt).toLocaleString()}
                              </span>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Changed <span className="font-mono">{audit.fieldName}</span>
                            </div>
                            {audit.oldValue && (
                              <div className="text-xs">
                                <span className="text-muted-foreground">From: </span>
                                <span className="line-clamp-2">{audit.oldValue}</span>
                              </div>
                            )}
                            {audit.newValue && (
                              <div className="text-xs">
                                <span className="text-muted-foreground">To: </span>
                                <span className="line-clamp-2">{audit.newValue}</span>
                              </div>
                            )}
                            {audit.comment && (
                              <div className="text-xs mt-1 italic text-muted-foreground">
                                &ldquo;{audit.comment}&rdquo;
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">
                        No change history recorded yet.
                      </p>
                    )}
                  </TabsContent>
                </Tabs>
              ) : null}
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
