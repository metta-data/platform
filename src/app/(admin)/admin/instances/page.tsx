"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
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

export default function InstancesPage() {
  const [instances, setInstances] = useState<Instance[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    url: "",
    username: "",
    password: "",
  });
  const [saving, setSaving] = useState(false);

  const fetchInstances = () => {
    fetch("/api/instances")
      .then((r) => r.json())
      .then(setInstances)
      .catch(console.error);
  };

  useEffect(() => {
    fetchInstances();
  }, []);

  const handleCreate = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/instances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("Failed to create instance");
      setDialogOpen(false);
      setForm({ name: "", url: "", username: "", password: "" });
      fetchInstances();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">ServiceNow Instances</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>Add Instance</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add ServiceNow Instance</DialogTitle>
              <DialogDescription>
                Enter the connection details for your ServiceNow instance.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <label className="text-sm font-medium">Name</label>
                <Input
                  placeholder="e.g., Production"
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="text-sm font-medium">Instance URL</label>
                <Input
                  placeholder="https://instance.service-now.com"
                  value={form.url}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, url: e.target.value }))
                  }
                />
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
                <label className="text-sm font-medium">Password</label>
                <Input
                  type="password"
                  value={form.password}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, password: e.target.value }))
                  }
                />
              </div>
              <Button
                onClick={handleCreate}
                disabled={
                  saving ||
                  !form.name ||
                  !form.url ||
                  !form.username ||
                  !form.password
                }
                className="w-full"
              >
                {saving ? "Saving..." : "Add Instance"}
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {instances.map((inst) => (
                <TableRow key={inst.id}>
                  <TableCell className="font-medium">{inst.name}</TableCell>
                  <TableCell className="font-mono text-sm">{inst.url}</TableCell>
                  <TableCell>{inst.username}</TableCell>
                  <TableCell>{inst._count.snapshots}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
