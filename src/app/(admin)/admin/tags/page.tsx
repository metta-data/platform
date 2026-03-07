"use client";

import { useEffect, useState } from "react";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { TAG_PALETTE } from "@/lib/catalog/tag-colors";

interface Tag {
  id: string;
  name: string;
  color: string;
  tagType: "AUTO" | "USER";
  entryCount: number;
  createdAt: string;
}

export default function AdminTagsPage() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(TAG_PALETTE[0]);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Edit dialog
  const [editTag, setEditTag] = useState<Tag | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const fetchTags = () => {
    setLoading(true);
    fetch("/api/tags")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setTags(data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchTags();
  }, []);

  const handleCreate = async () => {
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName, color: newColor }),
      });
      if (!res.ok) {
        const data = await res.json();
        setCreateError(data.error || "Failed to create tag");
        return;
      }
      setCreateOpen(false);
      setNewName("");
      setNewColor(TAG_PALETTE[0]);
      fetchTags();
    } catch {
      setCreateError("Failed to create tag");
    } finally {
      setCreating(false);
    }
  };

  const handleEdit = async () => {
    if (!editTag) return;
    setSaving(true);
    setEditError(null);
    try {
      const res = await fetch(`/api/tags/${editTag.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName, color: editColor }),
      });
      if (!res.ok) {
        const data = await res.json();
        setEditError(data.error || "Failed to update tag");
        return;
      }
      setEditTag(null);
      fetchTags();
    } catch {
      setEditError("Failed to update tag");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (tag: Tag) => {
    const msg =
      tag.tagType === "AUTO"
        ? `Delete auto-tag "${tag.name}"? It may be re-created automatically when definitions are saved.`
        : `Delete tag "${tag.name}"? This will remove it from all ${tag.entryCount} entries.`;
    if (!confirm(msg)) return;

    try {
      const res = await fetch(`/api/tags/${tag.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      fetchTags();
    } catch (err) {
      console.error(err);
    }
  };

  const openEdit = (tag: Tag) => {
    setEditTag(tag);
    setEditName(tag.name);
    setEditColor(tag.color);
    setEditError(null);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Tags</h1>
        <Button onClick={() => setCreateOpen(true)}>Create Tag</Button>
      </div>

      <Card>
        {loading ? (
          <CardContent className="py-8 text-center text-muted-foreground">
            Loading tags...
          </CardContent>
        ) : tags.length === 0 ? (
          <CardContent className="py-8 text-center text-muted-foreground">
            No tags yet. Tags are auto-created when definitions are saved, or
            you can create them manually.
          </CardContent>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Color</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Entries</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tags.map((tag) => (
                <TableRow key={tag.id}>
                  <TableCell>
                    <span
                      className="inline-block h-5 w-5 rounded-full border"
                      style={{
                        backgroundColor: tag.color,
                        borderColor: `${tag.color}80`,
                      }}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{tag.name}</TableCell>
                  <TableCell>
                    <Badge variant={tag.tagType === "AUTO" ? "secondary" : "outline"}>
                      {tag.tagType}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{tag.entryCount}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEdit(tag)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive"
                        onClick={() => handleDelete(tag)}
                      >
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Tag</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Name</label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Tag name"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Color</label>
              <div className="grid grid-cols-6 gap-2 mt-2">
                {TAG_PALETTE.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`h-8 w-8 rounded-full border-2 transition-all ${
                      newColor === c
                        ? "border-foreground scale-110"
                        : "border-transparent hover:scale-105"
                    }`}
                    style={{ backgroundColor: c }}
                    onClick={() => setNewColor(c)}
                  />
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm">Preview:</span>
              <span
                className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-sm font-medium"
                style={{
                  backgroundColor: `${newColor}1A`,
                  color: newColor,
                  borderColor: `${newColor}40`,
                }}
              >
                {newName || "Tag name"}
              </span>
            </div>
            {createError && (
              <p className="text-sm text-destructive">{createError}</p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={creating || !newName.trim()}>
                {creating ? "Creating..." : "Create"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editTag} onOpenChange={(v) => !v && setEditTag(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Tag</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Name</label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Tag name"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Color</label>
              <div className="grid grid-cols-6 gap-2 mt-2">
                {TAG_PALETTE.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`h-8 w-8 rounded-full border-2 transition-all ${
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
              <span className="text-sm">Preview:</span>
              <span
                className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-sm font-medium"
                style={{
                  backgroundColor: `${editColor}1A`,
                  color: editColor,
                  borderColor: `${editColor}40`,
                }}
              >
                {editName || "Tag name"}
              </span>
            </div>
            {editError && (
              <p className="text-sm text-destructive">{editError}</p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditTag(null)}>
                Cancel
              </Button>
              <Button onClick={handleEdit} disabled={saving || !editName.trim()}>
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
