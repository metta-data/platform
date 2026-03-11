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

interface CatalogStats {
  totalEntries: number;
  definedCount: number;
  undefinedCount: number;
  stewardedCount: number;
  tableCount: number;
}

export default function AdminPage() {
  const [snapshots, setSnapshots] = useState<SnapshotSummary[]>([]);
  const [instances, setInstances] = useState<{ id: string; name: string; url: string }[]>([]);
  const [aiModels, setAiModels] = useState<{ id: string }[]>([]);
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [catalogStats, setCatalogStats] = useState<CatalogStats | null>(null);

  useEffect(() => {
    fetch("/api/snapshots")
      .then((r) => r.json())
      .then(setSnapshots)
      .catch(console.error);
    fetch("/api/instances")
      .then((r) => r.json())
      .then(setInstances)
      .catch(console.error);
    fetch("/api/models")
      .then((r) => r.json())
      .then(setAiModels)
      .catch(console.error);
    fetch("/api/admin/users")
      .then((r) => r.json())
      .then((data: UserSummary[]) => setUsers(data))
      .catch(console.error);
    fetch("/api/catalog/stats")
      .then((r) => r.json())
      .then(setCatalogStats)
      .catch(console.error);
  }, []);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Admin Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-6 gap-6 mb-8">
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
            <CardTitle className="text-3xl">{aiModels.length}</CardTitle>
            <CardDescription>AI Models</CardDescription>
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
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl flex items-baseline gap-2">
              {catalogStats?.totalEntries ?? 0}
              {catalogStats && catalogStats.undefinedCount > 0 && (
                <span className="text-sm font-normal text-amber-600">
                  ({catalogStats.undefinedCount} undefined)
                </span>
              )}
            </CardTitle>
            <CardDescription>Catalog Entries</CardDescription>
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

        <Card>
          <CardHeader>
            <CardTitle>Data Catalog</CardTitle>
            <CardDescription>
              Generate and manage field definitions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/admin/catalog">Manage Catalog</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>AI Models</CardTitle>
            <CardDescription>
              Configure AI providers for definition drafting
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/admin/models">Manage Models</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tags</CardTitle>
            <CardDescription>
              Manage catalog entry tags and colors
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/admin/tags">Manage Tags</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Classifications</CardTitle>
            <CardDescription>
              Manage data sensitivity and compliance labels
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/admin/classifications">Manage Classifications</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
