"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";

interface EntryOption {
  id: string;
  tableName: string;
  element: string;
  label: string;
}

interface DeprecationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entryTableName: string;
  entryElement: string;
  isDeprecated: boolean;
  currentNote: string | null;
  currentSupersededBy: EntryOption | null;
  onSubmit: (data: {
    isDeprecated: boolean;
    deprecationNote?: string;
    supersededById?: string | null;
  }) => Promise<void>;
}

export function DeprecationDialog({
  open,
  onOpenChange,
  entryTableName,
  entryElement,
  isDeprecated,
  currentNote,
  currentSupersededBy,
  onSubmit,
}: DeprecationDialogProps) {
  const [note, setNote] = useState(currentNote || "");
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<EntryOption[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<EntryOption | null>(
    currentSupersededBy
  );
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setNote(currentNote || "");
      setSelectedEntry(currentSupersededBy);
      setSearch("");
      setSearchResults([]);
    }
  }, [open, currentNote, currentSupersededBy]);

  const searchEntries = useCallback(
    async (query: string) => {
      if (!query.trim()) {
        setSearchResults([]);
        return;
      }
      setSearching(true);
      try {
        const res = await fetch(
          `/api/catalog?search=${encodeURIComponent(query)}&limit=10`
        );
        if (res.ok) {
          const data = await res.json();
          setSearchResults(
            (data.entries || [])
              .filter(
                (e: EntryOption) =>
                  !(e.tableName === entryTableName && e.element === entryElement)
              )
              .map((e: EntryOption) => ({
                id: e.id,
                tableName: e.tableName,
                element: e.element,
                label: e.label,
              }))
          );
        }
      } catch {
        // ignore
      } finally {
        setSearching(false);
      }
    },
    [entryTableName, entryElement]
  );

  useEffect(() => {
    const timer = setTimeout(() => searchEntries(search), 300);
    return () => clearTimeout(timer);
  }, [search, searchEntries]);

  const handleDeprecate = async () => {
    setSubmitting(true);
    try {
      await onSubmit({
        isDeprecated: true,
        deprecationNote: note || undefined,
        supersededById: selectedEntry?.id || null,
      });
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUndeprecate = async () => {
    setSubmitting(true);
    try {
      await onSubmit({ isDeprecated: false });
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isDeprecated ? "Manage Deprecation" : "Deprecate Entry"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            <span className="font-mono">
              {entryTableName}.{entryElement}
            </span>
          </p>

          {!isDeprecated && (
            <>
              <div>
                <label className="text-sm font-medium">
                  Deprecation Note
                </label>
                <textarea
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                  rows={2}
                  placeholder="Why is this entry being deprecated?"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm font-medium">
                  Superseded By (optional)
                </label>
                <p className="text-xs text-muted-foreground mb-1">
                  Link to the entry that replaces this one
                </p>
                {selectedEntry ? (
                  <div className="flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2">
                    <span className="text-sm font-mono flex-1">
                      {selectedEntry.tableName}.{selectedEntry.element}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs"
                      onClick={() => setSelectedEntry(null)}
                    >
                      Clear
                    </Button>
                  </div>
                ) : (
                  <>
                    <Input
                      placeholder="Search for replacement entry..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="h-8 text-sm"
                    />
                    {(searchResults.length > 0 || searching) && (
                      <div className="mt-1 max-h-32 overflow-y-auto rounded-md border">
                        {searching ? (
                          <p className="py-2 text-center text-xs text-muted-foreground">
                            Searching...
                          </p>
                        ) : (
                          searchResults.map((entry) => (
                            <button
                              key={entry.id}
                              type="button"
                              className="flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent text-left"
                              onClick={() => {
                                setSelectedEntry(entry);
                                setSearch("");
                                setSearchResults([]);
                              }}
                            >
                              <span className="font-mono text-xs">
                                {entry.tableName}.{entry.element}
                              </span>
                              <span className="text-xs text-muted-foreground truncate">
                                {entry.label}
                              </span>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDeprecate}
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Deprecating...
                    </>
                  ) : (
                    "Deprecate"
                  )}
                </Button>
              </div>
            </>
          )}

          {isDeprecated && (
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleUndeprecate}
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Restoring...
                  </>
                ) : (
                  "Remove Deprecation"
                )}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
