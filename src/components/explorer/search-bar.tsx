"use client";

import { useCallback, useState } from "react";
import { Input } from "@/components/ui/input";
import { useExplorerStore } from "@/stores/explorer-store";

export function SearchBar() {
  const setSearchQuery = useExplorerStore((s) => s.setSearchQuery);
  const [localValue, setLocalValue] = useState("");

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setLocalValue(value);
      // Debounce the store update
      const timeout = setTimeout(() => setSearchQuery(value), 200);
      return () => clearTimeout(timeout);
    },
    [setSearchQuery]
  );

  return (
    <Input
      type="search"
      placeholder="Search tables..."
      value={localValue}
      onChange={handleChange}
      className="w-[250px]"
    />
  );
}
