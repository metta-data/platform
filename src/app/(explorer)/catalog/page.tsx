"use client";

import { useEffect, useState, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { LinkifiedText } from "@/components/ui/linkified-text";
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
import { TagBadge, TagOverflow } from "@/components/catalog/tag-badge";
import { TagSelector } from "@/components/catalog/tag-selector";
import { ClassificationBadge, ClassificationOverflow } from "@/components/catalog/classification-badge";
import { ClassificationSelector } from "@/components/catalog/classification-selector";
import { DeprecationBadge } from "@/components/catalog/deprecation-badge";
import { DeprecationDialog } from "@/components/catalog/deprecation-dialog";
import { CatalogComments } from "@/components/catalog/catalog-comments";
import { ExplorerLink } from "@/components/explorer/explorer-link";

interface TagInfo {
  id: string;
  name: string;
  color: string;
  tagType: "AUTO" | "USER";
}

interface ClassificationInfo {
  classificationLevel: {
    id: string;
    name: string;
    color: string;
    severity: number;
  };
}

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
  tags?: { tag: TagInfo }[];
  classifications?: ClassificationInfo[];
  isDeprecated?: boolean;
  supersededBy?: { tableName: string; element: string; label: string } | null;
  _count?: { comments: number };
  createdAt: string;
  updatedAt: string;
}

interface CatalogEntryDetail {
  entry: Omit<CatalogEntrySummary, "tags"> & {
    definitionSourceDetail: string | null;
    citationUrl: string | null;
    validatedAt: string | null;
    validatedBy: {
      id: string;
      username: string;
      displayName: string | null;
    } | null;
    tags: TagInfo[];
    classifications: {
      id: string;
      classificationLevel: {
        id: string;
        name: string;
        color: string;
        severity: number;
        description: string | null;
      };
      classifiedBy: { id: string; username: string; displayName: string | null };
      justification: string | null;
      classifiedAt: string;
    }[];
    isDeprecated: boolean;
    deprecatedAt: string | null;
    deprecatedBy: { id: string; username: string; displayName: string | null } | null;
    deprecationNote: string | null;
    supersededBy: { id: string; tableName: string; element: string; label: string } | null;
    supersedes: { id: string; tableName: string; element: string; label: string }[];
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
  classifiedCount: number;
  deprecatedCount: number;
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
  AI_GENERATED: "AI",
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
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const [classificationFilter, setClassificationFilter] = useState<string>("");
  const [deprecatedFilter, setDeprecatedFilter] = useState<string>("");
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

  // AI drafting state
  const [drafting, setDrafting] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [aiDraftMeta, setAiDraftMeta] = useState<{
    model: string;
    modelId: string;
    provider: string;
    docsUrl: string | null;
    confidence: "high" | "medium" | "low" | "none";
    citations: {
      url: string;
      pageTitle: string;
      evidenceText: string;
      sectionHeading?: string;
    }[];
    notes?: string | null;
  } | null>(null);

  // Bulk selection state
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());
  const [bulkValidating, setBulkValidating] = useState(false);
  const [bulkAssigning, setBulkAssigning] = useState(false);

  // Distinct table names, types, and tags for filter dropdowns
  const [tableNames, setTableNames] = useState<string[]>([]);
  const [fieldTypes, setFieldTypes] = useState<string[]>([]);
  const [allTags, setAllTags] = useState<TagInfo[]>([]);
  const [allClassifications, setAllClassifications] = useState<{ id: string; name: string; color: string; severity: number }[]>([]);

  // Deprecation dialog
  const [deprecateDialogOpen, setDeprecateDialogOpen] = useState(false);

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

  // Fetch all tags for filter dropdown
  useEffect(() => {
    fetch("/api/tags")
      .then((r) => r.json())
      .then((tags) => {
        if (Array.isArray(tags)) setAllTags(tags);
      })
      .catch(() => {});
    fetch("/api/classifications")
      .then((r) => r.json())
      .then((levels) => {
        if (Array.isArray(levels)) setAllClassifications(levels);
      })
      .catch(() => {});
  }, []);

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
    if (tagFilter.length > 0) params.set("tags", tagFilter.join(","));
    if (classificationFilter) params.set("classification", classificationFilter);
    if (deprecatedFilter) params.set("deprecated", deprecatedFilter);
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
  }, [search, tableFilter, typeFilter, definedFilter, validatedFilter, sourceFilter, tagFilter, classificationFilter, deprecatedFilter, page]);

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
    setDraftError(null);
    setAiDraftMeta(null);

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
      // If saving an AI draft, include source metadata and citation URL
      const payload: Record<string, string | undefined | null> = {
        definition: editDefinition,
      };
      if (aiDraftMeta) {
        payload.definitionSource = "AI_GENERATED";
        const citedCount = aiDraftMeta.citations.length;
        const confidenceLabel =
          aiDraftMeta.confidence !== "none"
            ? `cited from ${citedCount} source${citedCount !== 1 ? "s" : ""}`
            : "uncited";
        payload.definitionSourceDetail = `AI: ${aiDraftMeta.model} (${confidenceLabel})`;
        payload.citationUrl = aiDraftMeta.docsUrl;
        payload.aiConfidence = aiDraftMeta.confidence;
      }

      const res = await fetch(
        `/api/catalog/${encodeURIComponent(selectedEntry.tableName)}/${encodeURIComponent(selectedEntry.element)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) throw new Error("Failed to save");
      const updated = await res.json();

      // Refresh full detail to get updated tags from auto-tagging
      const detailRes = await fetch(
        `/api/catalog/${encodeURIComponent(selectedEntry.tableName)}/${encodeURIComponent(selectedEntry.element)}`
      );
      const freshDetail = await detailRes.json();
      setDetail(freshDetail);
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
      setAiDraftMeta(null);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  // Draft definition with AI
  const handleDraftWithAI = async () => {
    if (!selectedEntry) return;
    setDrafting(true);
    setDraftError(null);
    try {
      const res = await fetch("/api/catalog/draft-definition", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tableName: selectedEntry.tableName,
          element: selectedEntry.element,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setDraftError(data.error || "Failed to draft definition");
        return;
      }
      // Enter edit mode with the AI draft
      setEditDefinition(data.definition);
      setAiDraftMeta({
        model: data.model,
        modelId: data.modelId,
        provider: data.provider,
        docsUrl: data.docsUrl || null,
        confidence: data.confidence || "none",
        citations: data.citations || [],
        notes: data.notes || null,
      });
      setEditing(true);
    } catch {
      setDraftError("Failed to reach the AI drafting service.");
    } finally {
      setDrafting(false);
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
          placeholder="Search fields... (try table.column)"
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
            <SelectItem value="AI_GENERATED">AI generated</SelectItem>
          </SelectContent>
        </Select>
        {allTags.length > 0 && (
          <Select
            value={tagFilter.length === 1 ? tagFilter[0] : tagFilter.length > 1 ? "__multi__" : ""}
            onValueChange={(v) => {
              if (v === "__all__") {
                setTagFilter([]);
              } else if (v !== "__multi__") {
                setTagFilter([v]);
              }
              setPage(1);
            }}
          >
            <SelectTrigger className="w-44">
              <SelectValue placeholder="All tags">
                {tagFilter.length === 0
                  ? "All tags"
                  : tagFilter.length === 1
                    ? allTags.find((t) => t.id === tagFilter[0])?.name || "Tag"
                    : `${tagFilter.length} tags`}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All tags</SelectItem>
              {allTags.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  <span className="flex items-center gap-2">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: t.color }}
                    />
                    {t.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {allClassifications.length > 0 && (
          <Select
            value={classificationFilter}
            onValueChange={(v) => {
              setClassificationFilter(v === "__all__" ? "" : v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-44">
              <SelectValue placeholder="All classifications">
                {classificationFilter
                  ? allClassifications.find((c) => c.id === classificationFilter)?.name || "Classification"
                  : "All classifications"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All classifications</SelectItem>
              {allClassifications.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  <span className="flex items-center gap-2">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: c.color }}
                    />
                    {c.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Select
          value={deprecatedFilter}
          onValueChange={(v) => {
            setDeprecatedFilter(v === "__all__" ? "" : v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All entries" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All entries</SelectItem>
            <SelectItem value="false">Active only</SelectItem>
            <SelectItem value="true">Deprecated only</SelectItem>
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
                  <TableHead>Classification</TableHead>
                  <TableHead>Tags</TableHead>
                  <TableHead>Steward</TableHead>
                  <TableHead className="w-[40px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow
                    key={entry.id}
                    className={`cursor-pointer hover:bg-accent/50 ${entry.isDeprecated ? "opacity-60" : ""}`}
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
                      <div className="flex items-center gap-1.5">
                        {entry.element}
                        {entry.isDeprecated && <DeprecationBadge />}
                      </div>
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
                    <TableCell>
                      {entry.classifications && entry.classifications.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {entry.classifications
                            .sort((a, b) => b.classificationLevel.severity - a.classificationLevel.severity)
                            .slice(0, 2)
                            .map((c) => (
                              <ClassificationBadge
                                key={c.classificationLevel.id}
                                name={c.classificationLevel.name}
                                color={c.classificationLevel.color}
                                severity={c.classificationLevel.severity}
                              />
                            ))}
                          {entry.classifications.length > 2 && (
                            <ClassificationOverflow count={entry.classifications.length - 2} />
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {entry.tags && entry.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {entry.tags.slice(0, 3).map((t) => (
                            <TagBadge key={t.tag.id} name={t.tag.name} color={t.tag.color} />
                          ))}
                          {entry.tags.length > 3 && (
                            <TagOverflow count={entry.tags.length - 3} />
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {entry.steward?.displayName ||
                        entry.steward?.username ||
                        "\u2014"}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <ExplorerLink
                        tableName={entry.tableName}
                        column={entry.element}
                        variant="icon"
                      />
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
                  <ExplorerLink
                    tableName={selectedEntry.tableName}
                    column={selectedEntry.element}
                    variant="dropdown"
                  />
                </SheetTitle>
                <p className="text-sm text-muted-foreground">
                  {selectedEntry.label}
                </p>
              </SheetHeader>

              {/* Deprecation banner */}
              {detail?.entry.isDeprecated && (
                <div className="mx-4 mt-2 rounded-md border border-red-300 bg-red-50 dark:bg-red-950/30 dark:border-red-800 p-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-red-700 dark:text-red-400">
                    <DeprecationBadge />
                  </div>
                  {detail.entry.deprecationNote && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                      {detail.entry.deprecationNote}
                    </p>
                  )}
                  {detail.entry.supersededBy && (
                    <p className="mt-1 text-sm">
                      <span className="text-muted-foreground">Use </span>
                      <button
                        className="font-mono text-primary hover:underline"
                        onClick={() => {
                          const sup = detail.entry.supersededBy!;
                          const fake: CatalogEntrySummary = {
                            id: sup.id,
                            tableName: sup.tableName,
                            element: sup.element,
                            label: sup.label,
                            internalType: "",
                            definition: null,
                            definitionSource: null,
                            validationStatus: "",
                            steward: null,
                            createdAt: "",
                            updatedAt: "",
                          };
                          openDetail(fake);
                        }}
                      >
                        {detail.entry.supersededBy.tableName}.{detail.entry.supersededBy.element}
                      </button>
                      <span className="text-muted-foreground"> instead</span>
                    </p>
                  )}
                  {detail.entry.deprecatedBy && detail.entry.deprecatedAt && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Deprecated by {detail.entry.deprecatedBy.displayName || detail.entry.deprecatedBy.username} on{" "}
                      {new Date(detail.entry.deprecatedAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
              )}

              {detailLoading ? (
                <div className="space-y-4 px-4 mt-2">
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                </div>
              ) : detail ? (
                <Tabs defaultValue="definition" className="px-4 pb-6">
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
                    <TabsTrigger value="comments" className="flex-1">
                      Comments
                      {selectedEntry?._count?.comments ? (
                        <Badge variant="secondary" className="ml-1 text-[10px] px-1 py-0">
                          {selectedEntry._count.comments}
                        </Badge>
                      ) : null}
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
                        <div className="flex items-center justify-between">
                          <label className="text-sm font-medium">
                            Definition
                          </label>
                          {aiDraftMeta && (
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">
                                Drafted by {aiDraftMeta.model}
                              </span>
                              {aiDraftMeta.confidence === "high" && (
                                <Badge variant="default" className="text-[10px] px-1.5 py-0 bg-green-600 hover:bg-green-600">
                                  Cited
                                </Badge>
                              )}
                              {aiDraftMeta.confidence === "medium" && (
                                <Badge variant="default" className="text-[10px] px-1.5 py-0 bg-yellow-600 hover:bg-yellow-600">
                                  Partial
                                </Badge>
                              )}
                              {(aiDraftMeta.confidence === "low" || aiDraftMeta.confidence === "none") && (
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                  Uncited
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>
                        <textarea
                          className="w-full min-h-[120px] rounded-md border bg-background px-3 py-2 text-sm"
                          value={editDefinition}
                          onChange={(e) => setEditDefinition(e.target.value)}
                          placeholder="Enter a definition for this field..."
                        />
                        {aiDraftMeta && aiDraftMeta.citations.length > 0 && (
                          <div className="rounded-md border bg-muted/50 p-3 space-y-2">
                            <p className="text-xs font-medium text-muted-foreground">
                              Evidence from ServiceNow docs
                            </p>
                            {aiDraftMeta.citations.map((c, i) => (
                              <div key={i} className="text-xs space-y-0.5">
                                <p className="text-muted-foreground italic">
                                  &ldquo;{c.evidenceText}&rdquo;
                                </p>
                                <a
                                  href={c.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:underline dark:text-blue-400"
                                >
                                  {c.pageTitle}
                                  {c.sectionHeading ? ` > ${c.sectionHeading}` : ""}
                                  {" \u2192"}
                                </a>
                              </div>
                            ))}
                          </div>
                        )}
                        {aiDraftMeta?.notes && (
                          <p className="text-xs text-muted-foreground italic">
                            {aiDraftMeta.notes}
                          </p>
                        )}
                        {draftError && (
                          <p className="text-sm text-destructive">{draftError}</p>
                        )}
                        <div className="flex items-center gap-2">
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
                            onClick={() => {
                              setEditing(false);
                              setAiDraftMeta(null);
                              setDraftError(null);
                            }}
                          >
                            Cancel
                          </Button>
                          {canEdit && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="ml-auto"
                              onClick={handleDraftWithAI}
                              disabled={drafting}
                            >
                              {drafting ? "Drafting..." : "Draft with AI"}
                            </Button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">
                            Definition
                          </span>
                          {canEdit && (
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setEditDefinition(
                                    detail.entry.definition || ""
                                  );
                                  setAiDraftMeta(null);
                                  setEditing(true);
                                }}
                              >
                                Edit
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={handleDraftWithAI}
                                disabled={drafting}
                              >
                                {drafting ? "Drafting..." : "Draft with AI"}
                              </Button>
                            </div>
                          )}
                        </div>
                        {draftError && !editing && (
                          <p className="text-sm text-destructive mb-2">{draftError}</p>
                        )}
                        <p className="text-sm whitespace-pre-wrap">
                          {detail.entry.definition ? (
                            <LinkifiedText text={detail.entry.definition} />
                          ) : (
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
                        {detail.entry.citationUrl && (
                          <a
                            href={detail.entry.citationUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline dark:text-blue-400 mt-1"
                          >
                            ServiceNow docs &rarr;
                          </a>
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

                    {/* Tags */}
                    <div>
                      <span className="text-sm font-medium">Tags</span>
                      <div className="mt-1">
                        {canEdit ? (
                          <TagSelector
                            assignedTags={detail.entry.tags || []}
                            onTagUpdated={(updatedTag) => {
                              setDetail((prev) => {
                                if (!prev) return prev;
                                return {
                                  ...prev,
                                  entry: {
                                    ...prev.entry,
                                    tags: prev.entry.tags.map((t) =>
                                      t.id === updatedTag.id
                                        ? { ...t, name: updatedTag.name, color: updatedTag.color }
                                        : t
                                    ),
                                  },
                                };
                              });
                              fetchEntries();
                            }}
                            onAdd={async (tagIds) => {
                              await fetch("/api/catalog/tags", {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                  entryIds: [detail.entry.id],
                                  addTagIds: tagIds,
                                }),
                              });
                              // Refresh detail
                              const res = await fetch(
                                `/api/catalog/${encodeURIComponent(detail.entry.tableName)}/${encodeURIComponent(detail.entry.element)}`
                              );
                              const fresh = await res.json();
                              setDetail(fresh);
                              fetchEntries();
                            }}
                            onRemove={async (tagId) => {
                              await fetch("/api/catalog/tags", {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                  entryIds: [detail.entry.id],
                                  removeTagIds: [tagId],
                                }),
                              });
                              // Refresh detail
                              const res = await fetch(
                                `/api/catalog/${encodeURIComponent(detail.entry.tableName)}/${encodeURIComponent(detail.entry.element)}`
                              );
                              const fresh = await res.json();
                              setDetail(fresh);
                              fetchEntries();
                            }}
                          />
                        ) : detail.entry.tags && detail.entry.tags.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {detail.entry.tags.map((tag) => (
                              <TagBadge key={tag.id} name={tag.name} color={tag.color} />
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground italic">
                            No tags assigned
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Classifications */}
                    <div>
                      <span className="text-sm font-medium">Classifications</span>
                      <div className="mt-1">
                        {canEdit ? (
                          <ClassificationSelector
                            assigned={detail.entry.classifications || []}
                            onUpdate={async (addIds, removeIds) => {
                              await fetch(
                                `/api/catalog/${encodeURIComponent(detail.entry.tableName)}/${encodeURIComponent(detail.entry.element)}/classify`,
                                {
                                  method: "PATCH",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({
                                    addClassificationIds: addIds.length > 0 ? addIds : undefined,
                                    removeClassificationIds: removeIds.length > 0 ? removeIds : undefined,
                                  }),
                                }
                              );
                              // Refresh detail
                              const res = await fetch(
                                `/api/catalog/${encodeURIComponent(detail.entry.tableName)}/${encodeURIComponent(detail.entry.element)}`
                              );
                              const fresh = await res.json();
                              setDetail(fresh);
                              fetchEntries();
                            }}
                          />
                        ) : detail.entry.classifications && detail.entry.classifications.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {detail.entry.classifications.map((c) => (
                              <ClassificationBadge
                                key={c.classificationLevel.id}
                                name={c.classificationLevel.name}
                                color={c.classificationLevel.color}
                                severity={c.classificationLevel.severity}
                              />
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground italic">
                            No classifications assigned
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Deprecation controls */}
                    {canEdit && (
                      <div>
                        <span className="text-sm font-medium">Deprecation</span>
                        <div className="mt-1">
                          <Button
                            variant="outline"
                            size="sm"
                            className={detail.entry.isDeprecated ? "" : "text-destructive"}
                            onClick={() => setDeprecateDialogOpen(true)}
                          >
                            {detail.entry.isDeprecated ? "Manage Deprecation" : "Deprecate"}
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Supersedes (reverse) */}
                    {detail.entry.supersedes && detail.entry.supersedes.length > 0 && (
                      <div>
                        <span className="text-sm font-medium">Supersedes</span>
                        <div className="mt-1 space-y-1">
                          {detail.entry.supersedes.map((old) => (
                            <button
                              key={old.id}
                              className="block text-sm font-mono text-primary hover:underline"
                              onClick={() => {
                                const fake: CatalogEntrySummary = {
                                  id: old.id,
                                  tableName: old.tableName,
                                  element: old.element,
                                  label: old.label,
                                  internalType: "",
                                  definition: null,
                                  definitionSource: null,
                                  validationStatus: "",
                                  steward: null,
                                  createdAt: "",
                                  updatedAt: "",
                                };
                                openDetail(fake);
                              }}
                            >
                              {old.tableName}.{old.element}
                            </button>
                          ))}
                        </div>
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

                  {/* Comments Tab */}
                  <TabsContent value="comments" className="space-y-3">
                    <CatalogComments
                      tableName={detail.entry.tableName}
                      element={detail.entry.element}
                      currentUserId={currentUserId || undefined}
                      userRole={userRole || undefined}
                    />
                  </TabsContent>
                </Tabs>
              ) : null}
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Deprecation Dialog */}
      {detail && (
        <DeprecationDialog
          open={deprecateDialogOpen}
          onOpenChange={setDeprecateDialogOpen}
          entryTableName={detail.entry.tableName}
          entryElement={detail.entry.element}
          isDeprecated={detail.entry.isDeprecated || false}
          currentNote={detail.entry.deprecationNote || null}
          currentSupersededBy={detail.entry.supersededBy || null}
          onSubmit={async (data) => {
            const res = await fetch(
              `/api/catalog/${encodeURIComponent(detail.entry.tableName)}/${encodeURIComponent(detail.entry.element)}`,
              {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
              }
            );
            if (!res.ok) throw new Error("Failed to update deprecation");
            // Refresh detail
            const detailRes = await fetch(
              `/api/catalog/${encodeURIComponent(detail.entry.tableName)}/${encodeURIComponent(detail.entry.element)}`
            );
            if (detailRes.ok) setDetail(await detailRes.json());
            fetchEntries();
          }}
        />
      )}
    </div>
  );
}
