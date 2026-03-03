"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Instance {
  id: string;
  name: string;
  url: string;
  username: string;
  isActive: boolean;
  createdAt: string;
  _count: { snapshots: number };
}

const emptyForm = { name: "", url: "", username: "", password: "" };

function validateInstanceUrl(input: string): { cleanUrl: string | null; error: string | null } {
  const trimmed = input.trim();
  if (!trimmed) return { cleanUrl: null, error: "URL is required" };

  const withProtocol = trimmed.match(/^https?:\/\//) ? trimmed : `https://${trimmed}`;

  try {
    const parsed = new URL(withProtocol);

    if (!["https:", "http:"].includes(parsed.protocol)) {
      return { cleanUrl: null, error: "URL must use https:// or http://" };
    }

    if (!parsed.hostname.includes(".")) {
      return { cleanUrl: null, error: "Enter a full hostname (e.g., instance.service-now.com)" };
    }

    return { cleanUrl: parsed.origin, error: null };
  } catch {
    return { cleanUrl: null, error: "Invalid URL format" };
  }
}

export default function InstancesPage() {
  const [instances, setInstances] = useState<Instance[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingInstance, setEditingInstance] = useState<Instance | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const fetchInstances = () => {
    fetch("/api/instances")
      .then((r) => r.json())
      .then(setInstances)
      .catch(console.error);
  };

  useEffect(() => {
    fetchInstances();
  }, []);

  const resetDialog = () => {
    setEditingInstance(null);
    setForm(emptyForm);
    setUrlError(null);
    setTestResult(null);
  };

  const openCreate = () => {
    resetDialog();
    setDialogOpen(true);
  };

  const openEdit = (inst: Instance) => {
    setEditingInstance(inst);
    setForm({
      name: inst.name,
      url: inst.url,
      username: inst.username,
      password: "",
    });
    setUrlError(null);
    setTestResult(null);
    setDialogOpen(true);
  };

  const handleUrlChange = (value: string) => {
    setForm((f) => ({ ...f, url: value }));
    if (urlError) setUrlError(null);
    if (testResult) setTestResult(null);
  };

  const handleUrlBlur = () => {
    if (!form.url.trim()) {
      setUrlError(null);
      return;
    }
    const { cleanUrl, error } = validateInstanceUrl(form.url);
    if (error) {
      setUrlError(error);
    } else if (cleanUrl && cleanUrl !== form.url) {
      setForm((f) => ({ ...f, url: cleanUrl }));
      setUrlError(null);
    } else {
      setUrlError(null);
    }
  };

  const handleTestConnection = async () => {
    const { cleanUrl, error } = validateInstanceUrl(form.url);
    if (error || !cleanUrl) {
      setUrlError(error || "Invalid URL");
      return;
    }

    if (!form.username || !form.password) {
      setTestResult({ success: false, message: "Username and password are required to test connection." });
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      const res = await fetch("/api/instances/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: cleanUrl, username: form.username, password: form.password }),
      });
      const data = await res.json();
      if (data.success) {
        setTestResult({ success: true, message: data.message });
      } else {
        setTestResult({ success: false, message: data.error });
      }
    } catch {
      setTestResult({ success: false, message: "Failed to reach the test endpoint." });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    const { cleanUrl, error } = validateInstanceUrl(form.url);
    if (error || !cleanUrl) {
      setUrlError(error || "Invalid URL");
      return;
    }

    setSaving(true);
    try {
      const payload = { ...form, url: cleanUrl };
      if (editingInstance) {
        const res = await fetch(`/api/instances/${editingInstance.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("Failed to update instance");
      } else {
        const res = await fetch("/api/instances", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("Failed to create instance");
      }
      setDialogOpen(false);
      resetDialog();
      fetchInstances();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this instance? This will not delete associated snapshots.")) {
      return;
    }
    setDeleting(id);
    try {
      const res = await fetch(`/api/instances/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete instance");
      fetchInstances();
    } catch (err) {
      console.error(err);
    } finally {
      setDeleting(null);
    }
  };

  const isCreateMode = !editingInstance;
  const canSave = isCreateMode
    ? form.name && form.url && form.username && form.password && !urlError
    : form.name && form.url && form.username && !urlError;
  const canTest = form.url && form.username && form.password && !urlError;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">ServiceNow Instances</h1>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetDialog();
        }}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}>Add Instance</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {isCreateMode ? "Add ServiceNow Instance" : "Edit ServiceNow Instance"}
              </DialogTitle>
              <DialogDescription>
                {isCreateMode
                  ? "Enter the connection details for your ServiceNow instance."
                  : "Update the connection details. Leave password blank to keep the existing one."}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <label className="text-sm font-medium">Name</label>
                <Input
                  placeholder="e.g., Production, Dev Zurich"
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="text-sm font-medium">Instance URL</label>
                <Input
                  placeholder="https://myinstance.service-now.com"
                  value={form.url}
                  onChange={(e) => handleUrlChange(e.target.value)}
                  onBlur={handleUrlBlur}
                  aria-invalid={!!urlError}
                />
                {urlError ? (
                  <p className="text-sm text-destructive mt-1">{urlError}</p>
                ) : (
                  <p className="text-xs text-muted-foreground mt-1">
                    e.g., https://dev12345.service-now.com
                  </p>
                )}
              </div>
              <div>
                <label className="text-sm font-medium">Username</label>
                <Input
                  placeholder="admin"
                  value={form.username}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, username: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="text-sm font-medium">
                  Password{!isCreateMode && " (leave blank to keep current)"}
                </label>
                <Input
                  type="password"
                  placeholder={isCreateMode ? "" : "••••••••"}
                  value={form.password}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, password: e.target.value }))
                  }
                />
              </div>

              {/* Test Connection */}
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleTestConnection}
                  disabled={testing || !canTest}
                  className="shrink-0"
                >
                  {testing ? "Testing..." : "Test Connection"}
                </Button>
                {testResult && (
                  <p className={`text-sm ${testResult.success ? "text-green-600" : "text-destructive"}`}>
                    {testResult.message}
                  </p>
                )}
              </div>

              <Button
                onClick={handleSave}
                disabled={saving || !canSave}
                className="w-full"
              >
                {saving
                  ? "Saving..."
                  : isCreateMode
                    ? "Add Instance"
                    : "Update Instance"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {instances.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No instances configured yet. Add one to start ingesting schemas.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>URL</TableHead>
                <TableHead>Username</TableHead>
                <TableHead>Snapshots</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {instances.map((inst) => (
                <TableRow key={inst.id}>
                  <TableCell className="font-medium">{inst.name}</TableCell>
                  <TableCell className="font-mono text-sm max-w-[300px] truncate">
                    {inst.url}
                  </TableCell>
                  <TableCell>{inst.username}</TableCell>
                  <TableCell>{inst._count.snapshots}</TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEdit(inst)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleDelete(inst.id)}
                      disabled={deleting === inst.id}
                    >
                      {deleting === inst.id ? "Deleting..." : "Delete"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
