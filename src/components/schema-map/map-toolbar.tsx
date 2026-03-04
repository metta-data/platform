"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Maximize2, GitBranch, ArrowUpRight, ArrowDown, ArrowRight } from "lucide-react";
import { useState, useCallback } from "react";

interface MapToolbarProps {
  depth: number;
  onDepthChange: (depth: number) => void;
  showRefs: boolean;
  onToggleRefs: () => void;
  direction: "TB" | "LR";
  onDirectionChange: (dir: "TB" | "LR") => void;
  onFitView: () => void;
  onSearch: (tableName: string) => void;
}

export function MapToolbar({
  depth,
  onDepthChange,
  showRefs,
  onToggleRefs,
  direction,
  onDirectionChange,
  onFitView,
  onSearch,
}: MapToolbarProps) {
  const [searchValue, setSearchValue] = useState("");

  const handleSearch = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (searchValue.trim()) {
        onSearch(searchValue.trim());
        setSearchValue("");
      }
    },
    [searchValue, onSearch]
  );

  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/30 flex-wrap">
      {/* Search / Navigate */}
      <form onSubmit={handleSearch} className="flex items-center gap-1">
        <Input
          placeholder="Go to table..."
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          className="h-7 w-[160px] text-xs"
        />
      </form>

      <div className="w-px h-5 bg-border" />

      {/* View mode toggle */}
      <div className="flex items-center rounded-md border overflow-hidden">
        <Button
          variant={!showRefs ? "default" : "ghost"}
          size="sm"
          className="h-7 text-xs gap-1 rounded-none border-0"
          onClick={showRefs ? onToggleRefs : undefined}
        >
          <GitBranch className="w-3 h-3" />
          Hierarchy
        </Button>
        <div className="w-px h-5 bg-border" />
        <Button
          variant={showRefs ? "default" : "ghost"}
          size="sm"
          className="h-7 text-xs gap-1 rounded-none border-0"
          onClick={!showRefs ? onToggleRefs : undefined}
        >
          <ArrowUpRight className="w-3 h-3" />
          References
        </Button>
      </div>

      <div className="w-px h-5 bg-border" />

      {/* Depth selector — only relevant in hierarchy mode */}
      <div className={`flex items-center gap-1 transition-opacity ${showRefs ? "opacity-40 pointer-events-none" : ""}`}>
        <Select
          value={String(depth)}
          onValueChange={(v) => onDepthChange(parseInt(v, 10))}
        >
          <SelectTrigger className="h-7 w-[80px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">1 level</SelectItem>
            <SelectItem value="2">2 levels</SelectItem>
            <SelectItem value="3">3 levels</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Layout direction — only relevant in hierarchy mode */}
      <Button
        variant="outline"
        size="sm"
        className={`h-7 text-xs gap-1 transition-opacity ${showRefs ? "opacity-40 pointer-events-none" : ""}`}
        onClick={() => onDirectionChange(direction === "TB" ? "LR" : "TB")}
        title={direction === "TB" ? "Top-to-bottom" : "Left-to-right"}
      >
        {direction === "TB" ? (
          <ArrowDown className="w-3 h-3" />
        ) : (
          <ArrowRight className="w-3 h-3" />
        )}
      </Button>

      <div className="flex-1" />

      {/* Fit view */}
      <Button
        variant="outline"
        size="sm"
        className="h-7 text-xs gap-1"
        onClick={onFitView}
      >
        <Maximize2 className="w-3 h-3" />
        Fit
      </Button>
    </div>
  );
}
