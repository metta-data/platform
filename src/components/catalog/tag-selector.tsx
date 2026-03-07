"use client";

import { useState, useCallback } from "react";
import { Plus, Check, Loader2, Pencil, X } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TagBadge } from "./tag-badge";
import { TAG_PALETTE } from "@/lib/catalog/tag-colors";

interface Tag {
  id: string;
  name: string;
  color: string;
  tagType: "AUTO" | "USER";
}

interface TagSelectorProps {
  /** Currently assigned tag objects */
  assignedTags: Tag[];
  /** Called when tags should be added */
  onAdd: (tagIds: string[]) => void;
  /** Called when a tag should be removed */
  onRemove: (tagId: string) => void;
  /** Called when a tag is edited (name/color changed) so parent can refresh */
  onTagUpdated?: (tag: Tag) => void;
}

/** Pick a random color from the palette */
function randomColor(): string {
  return TAG_PALETTE[Math.floor(Math.random() * TAG_PALETTE.length)];
}

export function TagSelector({ assignedTags, onAdd, onRemove, onTagUpdated }: TagSelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  // Inline edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchTags = useCallback(() => {
    setLoading(true);
    fetch("/api/tags")
      .then((r) => r.json())
      .then((tags: Tag[]) => setAllTags(tags))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      setSearch("");
      setEditingId(null);
      fetchTags();
    }
  };

  const handleCreate = async () => {
    const name = search.trim();
    if (!name || creating) return;

    setCreating(true);
    try {
      const res = await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, color: randomColor() }),
      });
      if (!res.ok) return;
      const newTag: Tag = await res.json();
      setAllTags((prev) => [...prev, newTag]);
      onAdd([newTag.id]);
      setSearch("");
    } catch {
      // ignore
    } finally {
      setCreating(false);
    }
  };

  const startEdit = (tag: Tag) => {
    setEditingId(tag.id);
    setEditName(tag.name);
    setEditColor(tag.color);
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const saveEdit = async () => {
    if (!editingId || saving) return;
    const trimmed = editName.trim();
    if (!trimmed) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/tags/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed, color: editColor }),
      });
      if (!res.ok) return;
      const updated: Tag = await res.json();
      setAllTags((prev) =>
        prev.map((t) => (t.id === updated.id ? { ...t, name: updated.name, color: updated.color } : t))
      );
      onTagUpdated?.(updated);
      setEditingId(null);
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  const assignedIds = new Set(assignedTags.map((t) => t.id));
  const trimmedSearch = search.trim().toLowerCase();
  const filtered = allTags.filter(
    (t) => t.name.toLowerCase().includes(trimmedSearch)
  );
  const exactMatch = allTags.some(
    (t) => t.name.toLowerCase() === trimmedSearch
  );
  const showCreate = trimmedSearch.length > 0 && !exactMatch && !loading;

  const openEditForTag = (tag: Tag) => {
    setEditingId(tag.id);
    setEditName(tag.name);
    setEditColor(tag.color);
    setSearch("");
    if (!open) {
      setOpen(true);
      fetchTags();
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {assignedTags.map((tag) => (
        <TagBadge
          key={tag.id}
          name={tag.name}
          color={tag.color}
          onClick={() => openEditForTag(tag)}
          onRemove={() => onRemove(tag.id)}
        />
      ))}

      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-6 gap-1 px-2 text-xs">
            <Plus className="h-3 w-3" />
            Tag
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-2" align="start">
          {editingId === null ? (
            <>
              <Input
                placeholder="Search or create tags..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && showCreate) {
                    e.preventDefault();
                    handleCreate();
                  }
                }}
                className="mb-2 h-8 text-sm"
              />
              <div className="max-h-48 overflow-y-auto">
                {loading ? (
                  <p className="py-2 text-center text-xs text-muted-foreground">
                    Loading...
                  </p>
                ) : (
                  <>
                    {filtered.map((tag) => {
                      const isAssigned = assignedIds.has(tag.id);
                      return (
                        <div
                          key={tag.id}
                          className="group flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent"
                        >
                          <button
                            type="button"
                            className="flex flex-1 items-center gap-2 min-w-0"
                            onClick={() => {
                              if (isAssigned) {
                                onRemove(tag.id);
                              } else {
                                onAdd([tag.id]);
                              }
                            }}
                          >
                            <span
                              className="h-3 w-3 shrink-0 rounded-full border"
                              style={{
                                backgroundColor: tag.color,
                                borderColor: `${tag.color}80`,
                              }}
                            />
                            <span className="flex-1 truncate text-left">{tag.name}</span>
                            {isAssigned && (
                              <Check className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            )}
                          </button>
                          <button
                            type="button"
                            className="shrink-0 rounded p-0.5 opacity-0 hover:bg-black/10 group-hover:opacity-100 dark:hover:bg-white/10"
                            onClick={(e) => {
                              e.stopPropagation();
                              startEdit(tag);
                            }}
                            title="Edit tag"
                          >
                            <Pencil className="h-3 w-3 text-muted-foreground" />
                          </button>
                        </div>
                      );
                    })}
                    {filtered.length === 0 && !showCreate && (
                      <p className="py-2 text-center text-xs text-muted-foreground">
                        No tags found
                      </p>
                    )}
                    {showCreate && (
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent text-primary"
                        onClick={handleCreate}
                        disabled={creating}
                      >
                        {creating ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Plus className="h-3 w-3" />
                        )}
                        <span className="flex-1 truncate text-left">
                          Create &ldquo;{search.trim()}&rdquo;
                        </span>
                      </button>
                    )}
                  </>
                )}
              </div>
            </>
          ) : (
            /* Inline edit view */
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Edit Tag</span>
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="rounded p-0.5 hover:bg-accent"
                >
                  <X className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </div>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    saveEdit();
                  }
                  if (e.key === "Escape") {
                    cancelEdit();
                  }
                }}
                placeholder="Tag name"
                className="h-8 text-sm"
                autoFocus
              />
              <div>
                <span className="mb-1.5 block text-xs text-muted-foreground">Color</span>
                <div className="grid grid-cols-6 gap-1.5">
                  {TAG_PALETTE.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={`h-6 w-6 rounded-full border-2 transition-all ${
                        editColor === c
                          ? "border-foreground scale-110"
                          : "border-transparent hover:scale-105"
                      }`}
                      style={{ backgroundColor: c }}
                      onClick={() => setEditColor(c)}
                    />
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Preview:</span>
                <TagBadge name={editName || "Tag"} color={editColor} />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={cancelEdit}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="h-7 text-xs"
                  onClick={saveEdit}
                  disabled={saving || !editName.trim()}
                >
                  {saving ? "Saving..." : "Save"}
                </Button>
              </div>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
