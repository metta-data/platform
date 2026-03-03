"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useExplorerStore } from "@/stores/explorer-store";

export function VersionSelector() {
  const { availableSnapshots, selectedSnapshotId, setSnapshot } =
    useExplorerStore();

  if (availableSnapshots.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">No snapshots available</div>
    );
  }

  return (
    <Select
      value={selectedSnapshotId || undefined}
      onValueChange={setSnapshot}
    >
      <SelectTrigger className="w-[220px]">
        <SelectValue placeholder="Select version..." />
      </SelectTrigger>
      <SelectContent>
        {availableSnapshots.map((snapshot) => (
          <SelectItem key={snapshot.id} value={snapshot.id}>
            {snapshot.label}
            {snapshot.version ? ` (${snapshot.version})` : ""}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
