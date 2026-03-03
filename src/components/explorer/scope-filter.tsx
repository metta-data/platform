"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useExplorerStore } from "@/stores/explorer-store";

interface ScopeFilterProps {
  scopes: { name: string; label: string; count: number }[];
}

export function ScopeFilter({ scopes }: ScopeFilterProps) {
  const { scopeFilter, setScopeFilter } = useExplorerStore();

  return (
    <Select
      value={scopeFilter || "__all__"}
      onValueChange={(v) => setScopeFilter(v === "__all__" ? null : v)}
    >
      <SelectTrigger className="w-[200px]">
        <SelectValue placeholder="All scopes" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__all__">All scopes</SelectItem>
        {scopes.map((scope) => (
          <SelectItem key={scope.name} value={scope.name}>
            {scope.label || scope.name} ({scope.count})
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
