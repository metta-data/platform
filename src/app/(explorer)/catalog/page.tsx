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
  steward: { id: string; username: string; displayName: string | null } | null;
  createdAt: string;
  updatedAt: string;
}

interface CatalogEntryDetail {
  entry: CatalogEntrySummary;
  sourceSnapshot: { id: string; label: string; createdAt: string };
  linkedSnapshots: {
    id: string;
    label: string;
    linkedAt: string;
    createdAt: string;
  }[];
  inheritingTables: string[];
}

interface CatalogStats {
  totalEntries: number;
  definedCount: number;
  undefinedCount: number;
  stewardedCount: number;
  tableCount: number;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

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

  // Distinct table names and types for filter dropdowns
  const [tableNames, setTableNames] = useState<string[]>([]);
  const [fieldTypes, setFieldTypes] = useState<string[]>([]);

  // Fetch user session to determine edit permissions
  const [canEdit, setCanEdit] = useState(false);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((session) => {
        const role = session?.user?.role;
        setCanEdit(
          role === "STEWARD" || role === "ADMIN"
        );
      })
      .catch(() => setCanEdit(false));
  }, []);

  // Fetch stats
  useEffect(() => {
    fetch("/api/catalog/stats")
      .then((r) => r.json())
      .then(setStats)
      .catch(console.error);
  }, []);

  // Fetch entries
  const fetchEntries = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (tableFilter) params.set("table", tableFilter);
    if (typeFilter) params.set("type", typeFilter);
    if (definedFilter) params.set("defined", definedFilter);
    params.set("page", String(page));
    params.set("limit", "50");

    fetch(`/api/catalog?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setEntries(data.entries);
        setPagination(data.pagination);

        // Build filter options from first fetch
        if (tableNames.length === 0 && data.entries.length > 0) {
          // Fetch all distinct table names and types from stats
          fetch("/api/catalog?limit=1")
            .then(() => {
              // Get distinct values via a separate call
              return fetch("/api/catalog?limit=100&page=1");
            })
            .then((r) => r.json())
            .catch(console.error);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [search, tableFilter, typeFilter, definedFilter, page, tableNames.length]);

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
              },
            }
          : prev
      );
      setEntries((prev) =>
        prev.map((e) =>
          e.id === selectedEntry.id
            ? { ...e, definition: updated.definition }
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

  // Search debounce
  const [searchInput, setSearchInput] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  return (
    <div className="p-6 max-w-7xl mx-auto overflow-auto h-full">
      <h1 className="text-2xl font-bold mb-4">Data Catalog</h1>

      {/* Stats bar */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
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
              <div className="text-2xl font-bold">{stats.stewardedCount}</div>
              <div className="text-xs text-muted-foreground">
                Has Steward
              </div>
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
      </div>

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
                  <TableHead>Table</TableHead>
                  <TableHead>Field</TableHead>
                  <TableHead>Label</TableHead>
                  <TableHead className="w-[120px]">Type</TableHead>
                  <TableHead>Definition</TableHead>
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
                    <TableCell className="text-sm max-w-[200px] truncate text-muted-foreground">
                      {entry.definition || (
                        <span className="italic text-muted-foreground/50">
                          No definition
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {entry.steward?.displayName || entry.steward?.username || "—"}
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
                Showing {(pagination.page - 1) * pagination.limit + 1}–
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
                  </TabsList>

                  <TabsContent value="definition" className="space-y-4">
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
                        <p className="text-sm">
                          {detail.entry.definition || (
                            <span className="italic text-muted-foreground">
                              No definition yet
                            </span>
                          )}
                        </p>
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
                </Tabs>
              ) : null}
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
