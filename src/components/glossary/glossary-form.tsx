"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ALL_CSDM_DOMAINS } from "@/lib/csdm/data";

const NONE = "__none__";

const CATEGORIES = [
  "CSDM Concept",
  "ServiceNow Concept",
  "General",
];

export interface GlossaryFormData {
  term: string;
  definition: string;
  category: string;
  relatedTables: string[];
  csdmDomainId: string;
}

interface GlossaryFormProps {
  initial?: Partial<GlossaryFormData>;
  onSubmit: (data: GlossaryFormData) => void;
  onCancel: () => void;
  submitLabel?: string;
  isLoading?: boolean;
}

export function GlossaryForm({
  initial,
  onSubmit,
  onCancel,
  submitLabel = "Create",
  isLoading = false,
}: GlossaryFormProps) {
  const [term, setTerm] = useState(initial?.term || "");
  const [definition, setDefinition] = useState(initial?.definition || "");
  const [category, setCategory] = useState(initial?.category || NONE);
  const [relatedTablesStr, setRelatedTablesStr] = useState(
    (initial?.relatedTables || []).join(", ")
  );
  const [csdmDomainId, setCsdmDomainId] = useState(
    initial?.csdmDomainId || NONE
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const relatedTables = relatedTablesStr
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    onSubmit({
      term: term.trim(),
      definition: definition.trim(),
      category: category === NONE ? "" : category,
      relatedTables,
      csdmDomainId: csdmDomainId === NONE ? "" : csdmDomainId,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Term */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium">
          Term <span className="text-destructive">*</span>
        </label>
        <Input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="e.g. CSDM"
          required
        />
      </div>

      {/* Definition */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium">
          Definition <span className="text-destructive">*</span>
        </label>
        <textarea
          value={definition}
          onChange={(e) => setDefinition(e.target.value)}
          placeholder="A clear, concise definition..."
          required
          rows={4}
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        />
      </div>

      {/* Category */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium">Category</label>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger>
            <SelectValue placeholder="Select a category..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>None</SelectItem>
            {CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* CSDM Domain */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium">CSDM Domain</label>
        <Select value={csdmDomainId} onValueChange={setCsdmDomainId}>
          <SelectTrigger>
            <SelectValue placeholder="Link to a CSDM domain..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>None</SelectItem>
            {ALL_CSDM_DOMAINS.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Related Tables */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium">Related Tables</label>
        <Input
          value={relatedTablesStr}
          onChange={(e) => setRelatedTablesStr(e.target.value)}
          placeholder="e.g. cmdb_ci_service, incident (comma-separated)"
        />
        <p className="text-xs text-muted-foreground">
          ServiceNow table names, comma-separated
        </p>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading || !term.trim() || !definition.trim()}>
          {isLoading ? "Saving..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}
