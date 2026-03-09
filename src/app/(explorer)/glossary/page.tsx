"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GlossaryForm, type GlossaryFormData } from "@/components/glossary/glossary-form";
import { ALL_CSDM_DOMAINS } from "@/lib/csdm/data";
import { Plus, Search, Pencil, Trash2, BookOpen, ArrowUpRight } from "lucide-react";
import { toast } from "sonner";

interface GlossaryTerm {
  id: string;
  term: string;
  definition: string;
  category: string | null;
  relatedTables: string[];
  csdmDomainId: string | null;
  createdBy: { id: string; displayName: string | null; username: string } | null;
  updatedBy: { id: string; displayName: string | null; username: string } | null;
  createdAt: string;
  updatedAt: string;
}

const ALL_CATEGORIES = "all";

export default function GlossaryPage() {
  const [terms, setTerms] = useState<GlossaryTerm[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState(ALL_CATEGORIES);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingTerm, setEditingTerm] = useState<GlossaryTerm | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchTerms = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (categoryFilter !== ALL_CATEGORIES) params.set("category", categoryFilter);
      const res = await fetch(`/api/glossary?${params}`);
      if (res.ok) {
        setTerms(await res.json());
      }
    } catch (err) {
      console.error("Failed to fetch glossary terms:", err);
    } finally {
      setLoading(false);
    }
  }, [search, categoryFilter]);

  useEffect(() => {
    const timeout = setTimeout(() => fetchTerms(), 300);
    return () => clearTimeout(timeout);
  }, [fetchTerms]);

  // Group terms by first letter
  const grouped = terms.reduce<Record<string, GlossaryTerm[]>>((acc, term) => {
    const letter = term.term[0]?.toUpperCase() || "#";
    if (!acc[letter]) acc[letter] = [];
    acc[letter].push(term);
    return acc;
  }, {});
  const sortedLetters = Object.keys(grouped).sort();

  // Unique categories for filter
  const categories = [...new Set(terms.map((t) => t.category).filter(Boolean))] as string[];

  async function handleCreate(data: GlossaryFormData) {
    setSubmitting(true);
    try {
      const res = await fetch("/api/glossary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || "Failed to create term");
        return;
      }
      toast.success("Term created");
      setShowCreateDialog(false);
      fetchTerms();
    } catch {
      toast.error("Failed to create term");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpdate(data: GlossaryFormData) {
    if (!editingTerm) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/glossary/${editingTerm.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || "Failed to update term");
        return;
      }
      toast.success("Term updated");
      setEditingTerm(null);
      fetchTerms();
    } catch {
      toast.error("Failed to update term");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(term: GlossaryTerm) {
    if (!confirm(`Delete "${term.term}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/glossary/${term.id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || "Failed to delete term");
        return;
      }
      toast.success("Term deleted");
      fetchTerms();
    } catch {
      toast.error("Failed to delete term");
    }
  }

  const domainLabel = (id: string) =>
    ALL_CSDM_DOMAINS.find((d) => d.id === id)?.label || id;

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto w-full px-6 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <BookOpen className="w-6 h-6" />
              Glossary
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Definitions for ServiceNow, CSDM, and domain-specific terminology.
            </p>
          </div>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="w-4 h-4 mr-1.5" />
            Add Term
          </Button>
        </div>

        {/* Search + Filter */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search terms..."
              className="pl-9"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_CATEGORIES}>All categories</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Terms list */}
        {loading ? (
          <div className="text-center text-muted-foreground py-12">
            Loading glossary...
          </div>
        ) : terms.length === 0 ? (
          <div className="text-center py-12 space-y-2">
            <p className="text-muted-foreground">
              {search || categoryFilter !== ALL_CATEGORIES
                ? "No terms match your filters."
                : "No glossary terms yet."}
            </p>
            {!search && categoryFilter === ALL_CATEGORIES && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCreateDialog(true)}
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Add the first term
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {sortedLetters.map((letter) => (
              <div key={letter}>
                <div className="text-lg font-bold text-muted-foreground mb-2 border-b pb-1">
                  {letter}
                </div>
                <div className="space-y-2">
                  {grouped[letter].map((term) => (
                    <Card key={term.id}>
                      <CardHeader className="py-3 px-4">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <CardTitle className="text-base">
                              {term.term}
                            </CardTitle>
                            <div className="flex items-center gap-2 mt-1">
                              {term.category && (
                                <Badge variant="secondary" className="text-xs">
                                  {term.category}
                                </Badge>
                              )}
                              {term.csdmDomainId && (
                                <Link href={`/csdm?domain=${term.csdmDomainId}`}>
                                  <Badge
                                    variant="outline"
                                    className="text-xs cursor-pointer hover:bg-accent"
                                  >
                                    {domainLabel(term.csdmDomainId)}
                                  </Badge>
                                </Link>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => setEditingTerm(term)}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                              onClick={() => handleDelete(term)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="py-0 px-4 pb-3">
                        <p className="text-sm text-muted-foreground">
                          {term.definition}
                        </p>
                        {term.relatedTables.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {term.relatedTables.map((t) => (
                              <Link
                                key={t}
                                href={`/explorer?table=${encodeURIComponent(t)}`}
                              >
                                <Badge
                                  variant="outline"
                                  className="text-xs font-mono cursor-pointer hover:bg-accent gap-1"
                                >
                                  {t}
                                  <ArrowUpRight className="w-2.5 h-2.5" />
                                </Badge>
                              </Link>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Glossary Term</DialogTitle>
          </DialogHeader>
          <GlossaryForm
            onSubmit={handleCreate}
            onCancel={() => setShowCreateDialog(false)}
            submitLabel="Create"
            isLoading={submitting}
          />
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editingTerm} onOpenChange={() => setEditingTerm(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Glossary Term</DialogTitle>
          </DialogHeader>
          {editingTerm && (
            <GlossaryForm
              initial={{
                term: editingTerm.term,
                definition: editingTerm.definition,
                category: editingTerm.category || "",
                relatedTables: editingTerm.relatedTables,
                csdmDomainId: editingTerm.csdmDomainId || "",
              }}
              onSubmit={handleUpdate}
              onCancel={() => setEditingTerm(null)}
              submitLabel="Save"
              isLoading={submitting}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
