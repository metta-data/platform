"use client";

import { useState, useCallback } from "react";
import { Check, Loader2, Shield } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ClassificationBadge } from "./classification-badge";

interface ClassificationLevel {
  id: string;
  name: string;
  color: string;
  severity: number;
  description: string | null;
}

interface ClassificationSelectorProps {
  /** Currently assigned classifications */
  assigned: { classificationLevel: ClassificationLevel }[];
  /** Called when classifications change */
  onUpdate: (addIds: string[], removeIds: string[]) => Promise<void>;
}

export function ClassificationSelector({
  assigned,
  onUpdate,
}: ClassificationSelectorProps) {
  const [open, setOpen] = useState(false);
  const [allLevels, setAllLevels] = useState<ClassificationLevel[]>([]);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [justification, setJustification] = useState("");

  const assignedIds = new Set(assigned.map((a) => a.classificationLevel.id));

  const fetchLevels = useCallback(() => {
    setLoading(true);
    fetch("/api/classifications")
      .then((r) => r.json())
      .then((data: ClassificationLevel[]) => setAllLevels(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      setJustification("");
      fetchLevels();
    }
  };

  const handleToggle = async (levelId: string) => {
    if (updating) return;
    setUpdating(true);
    try {
      if (assignedIds.has(levelId)) {
        await onUpdate([], [levelId]);
      } else {
        await onUpdate([levelId], []);
      }
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {assigned.map((a) => (
        <ClassificationBadge
          key={a.classificationLevel.id}
          name={a.classificationLevel.name}
          color={a.classificationLevel.color}
          severity={a.classificationLevel.severity}
        />
      ))}

      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-6 gap-1 px-2 text-xs">
            <Shield className="h-3 w-3" />
            Classify
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-2" align="start">
          <div className="mb-2">
            <Input
              placeholder="Justification (optional)"
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              className="h-8 text-sm"
            />
          </div>
          <div className="max-h-56 overflow-y-auto">
            {loading ? (
              <p className="py-2 text-center text-xs text-muted-foreground">
                Loading...
              </p>
            ) : (
              allLevels.map((level) => {
                const isAssigned = assignedIds.has(level.id);
                return (
                  <button
                    key={level.id}
                    type="button"
                    className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent"
                    onClick={() => handleToggle(level.id)}
                    disabled={updating}
                  >
                    <span
                      className="h-3 w-3 shrink-0 rounded-full border"
                      style={{
                        backgroundColor: level.color,
                        borderColor: `${level.color}80`,
                      }}
                    />
                    <div className="flex-1 text-left min-w-0">
                      <span className="truncate block font-medium">{level.name}</span>
                      {level.description && (
                        <span className="truncate block text-xs text-muted-foreground">
                          {level.description}
                        </span>
                      )}
                    </div>
                    {isAssigned && (
                      <Check className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    )}
                    {updating && (
                      <Loader2 className="h-3 w-3 animate-spin shrink-0" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
