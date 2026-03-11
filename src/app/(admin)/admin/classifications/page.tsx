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

interface ClassificationLevel {
  id: string;
  name: string;
  description: string | null;
  color: string;
  severity: number;
  isSystem: boolean;
  entryCount: number;
  createdAt: string;
}

export default function AdminClassificationsPage() {
  const [levels, setLevels] = useState<ClassificationLevel[]>([]);
  const [loading, setLoading] = useState(true);

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newColor, setNewColor] = useState(TAG_PALETTE[0]);
  const [newSeverity, setNewSeverity] = useState(0);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Edit dialog
  const [editLevel, setEditLevel] = useState<ClassificationLevel | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editColor, setEditColor] = useState("");
  const [editSeverity, setEditSeverity] = useState(0);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const fetchLevels = () => {
    setLoading(true);
    fetch("/api/classifications")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setLevels(data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchLevels();
  }, []);

  const handleCreate = async () => {
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch("/api/classifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName,
          description: newDescription || null,
          color: newColor,
          severity: newSeverity,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setCreateError(data.error || "Failed to create classification");
        return;
      }
      setCreateOpen(false);
      setNewName("");
      setNewDescription("");
      setNewColor(TAG_PALETTE[0]);
      setNewSeverity(0);
      fetchLevels();
    } catch {
      setCreateError("Failed to create classification");
    } finally {
      setCreating(false);
    }
  };

  const handleEdit = async () => {
    if (!editLevel) return;
    setSaving(true);
    setEditError(null);
    try {
      const res = await fetch(`/api/classifications/${editLevel.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName,
          description: editDescription || null,
          color: editColor,
          severity: editSeverity,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setEditError(data.error || "Failed to update classification");
        return;
      }
      setEditLevel(null);
      fetchLevels();
    } catch {
      setEditError("Failed to update classification");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (level: ClassificationLevel) => {
    if (level.isSystem) return;
    if (
      !confirm(
        `Delete classification "${level.name}"? This will remove it from all ${level.entryCount} entries.`
      )
    )
      return;

    try {
      const res = await fetch(`/api/classifications/${level.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete");
      fetchLevels();
    } catch (err) {
      console.error(err);
    }
  };

  const openEdit = (level: ClassificationLevel) => {
    setEditLevel(level);
    setEditName(level.name);
    setEditDescription(level.description || "");
    setEditColor(level.color);
    setEditSeverity(level.severity);
    setEditError(null);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Classifications</h1>
        <Button onClick={() => setCreateOpen(true)}>
          Create Classification
        </Button>
      </div>

      <Card>
        {loading ? (
          <CardContent className="py-8 text-center text-muted-foreground">
            Loading classifications...
          </CardContent>
        ) : levels.length === 0 ? (
          <CardContent className="py-8 text-center text-muted-foreground">
            No classification levels configured.
          </CardContent>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Color</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Severity</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Entries</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {levels.map((level) => (
                <TableRow key={level.id}>
                  <TableCell>
                    <span
                      className="inline-block h-5 w-5 rounded-full border"
                      style={{
                        backgroundColor: level.color,
                        borderColor: `${level.color}80`,
                      }}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{level.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                    {level.description}
                  </TableCell>
                  <TableCell className="text-right">{level.severity}</TableCell>
                  <TableCell>
                    <Badge
                      variant={level.isSystem ? "secondary" : "outline"}
                    >
                      {level.isSystem ? "System" : "Custom"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {level.entryCount}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEdit(level)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive"
                        onClick={() => handleDelete(level)}
                        disabled={level.isSystem}
                        title={
                          level.isSystem
                            ? "System classifications cannot be deleted"
                            : undefined
                        }
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
            <DialogTitle>Create Classification</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Name</label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g., FERPA, SOX"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <Input
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Short description"
              />
            </div>
            <div>
              <label className="text-sm font-medium">
                Severity (0 = lowest)
              </label>
              <Input
                type="number"
                min={0}
                value={newSeverity}
                onChange={(e) => setNewSeverity(parseInt(e.target.value) || 0)}
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
                {newName || "Classification"}
              </span>
            </div>
            {createError && (
              <p className="text-sm text-destructive">{createError}</p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleCreate}
                disabled={creating || !newName.trim()}
              >
                {creating ? "Creating..." : "Create"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog
        open={!!editLevel}
        onOpenChange={(v) => !v && setEditLevel(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Classification</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Name</label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Classification name"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <Input
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Short description"
              />
            </div>
            <div>
              <label className="text-sm font-medium">
                Severity (0 = lowest)
              </label>
              <Input
                type="number"
                min={0}
                value={editSeverity}
                onChange={(e) => setEditSeverity(parseInt(e.target.value) || 0)}
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
                {editName || "Classification"}
              </span>
            </div>
            {editError && (
              <p className="text-sm text-destructive">{editError}</p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditLevel(null)}>
                Cancel
              </Button>
              <Button
                onClick={handleEdit}
                disabled={saving || !editName.trim()}
              >
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
