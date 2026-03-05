"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { SnapshotSummary } from "@/types";

interface UserSummary {
  id: string;
  role: string;
}

export default function AdminPage() {
  const [snapshots, setSnapshots] = useState<SnapshotSummary[]>([]);
  const [instances, setInstances] = useState<{ id: string; name: string; url: string }[]>([]);
  const [users, setUsers] = useState<UserSummary[]>([]);

  useEffect(() => {
    fetch("/api/snapshots")
      .then((r) => r.json())
      .then(setSnapshots)
      .catch(console.error);
    fetch("/api/instances")
      .then((r) => r.json())
      .then(setInstances)
      .catch(console.error);
    fetch("/api/admin/users")
      .then((r) => r.json())
      .then((data: UserSummary[]) => setUsers(data))
      .catch(console.error);
  }, []);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Admin Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl">{snapshots.length}</CardTitle>
            <CardDescription>Schema Snapshots</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl">{instances.length}</CardTitle>
            <CardDescription>Connected Instances</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl">
              {snapshots.filter((s) => s.isBaseline).length}
            </CardTitle>
            <CardDescription>Baseline Schemas</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl flex items-baseline gap-2">
              {users.length}
              {users.filter((u) => u.role === "PENDING").length > 0 && (
                <span className="text-sm font-normal text-amber-600">
                  ({users.filter((u) => u.role === "PENDING").length} pending)
                </span>
              )}
            </CardTitle>
            <CardDescription>Users</CardDescription>
          </CardHeader>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>ServiceNow Instances</CardTitle>
            <CardDescription>
              Manage your ServiceNow instance connections
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/admin/instances">Manage Instances</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Schema Snapshots</CardTitle>
            <CardDescription>
              View and manage ingested schema snapshots
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/admin/snapshots">Manage Snapshots</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Users</CardTitle>
            <CardDescription>
              Manage user access and roles
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/admin/users">Manage Users</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
