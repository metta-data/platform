"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface VersionEntry {
  version: string;
  date: string | null;
  sections: { heading: string; items: string[] }[];
}

function parseChangelog(raw: string): VersionEntry[] {
  const entries: VersionEntry[] = [];
  let current: VersionEntry | null = null;
  let currentSection: { heading: string; items: string[] } | null = null;

  for (const line of raw.split("\n")) {
    // Version heading: ## [0.4.0] - 2026-03-07 or ## [Unreleased]
    const versionMatch = line.match(
      /^## \[(.+?)\](?:\s*-\s*(\d{4}-\d{2}-\d{2}))?/
    );
    if (versionMatch) {
      if (current) entries.push(current);
      current = {
        version: versionMatch[1],
        date: versionMatch[2] || null,
        sections: [],
      };
      currentSection = null;
      continue;
    }

    // Section heading: ### Added, ### Fixed, etc.
    const sectionMatch = line.match(/^### (.+)/);
    if (sectionMatch && current) {
      currentSection = { heading: sectionMatch[1], items: [] };
      current.sections.push(currentSection);
      continue;
    }

    // List item: - Something
    const itemMatch = line.match(/^- (.+)/);
    if (itemMatch && currentSection) {
      currentSection.items.push(itemMatch[1]);
    }
  }

  if (current) entries.push(current);
  return entries;
}

const SECTION_COLORS: Record<string, string> = {
  Added:
    "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  Changed:
    "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  Deprecated:
    "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  Removed:
    "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  Fixed:
    "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  Security:
    "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
};

export default function VersionPage() {
  const [entries, setEntries] = useState<VersionEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const appVersion = process.env.NEXT_PUBLIC_APP_VERSION || "0.0.0";
  const commitHash = process.env.NEXT_PUBLIC_COMMIT_HASH || "dev";

  useEffect(() => {
    fetch("/api/version")
      .then((r) => r.text())
      .then((raw) => setEntries(parseChangelog(raw)))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-6 max-w-3xl mx-auto overflow-auto h-full">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-1">Version History</h1>
        <p className="text-sm text-muted-foreground">
          Current version:{" "}
          <span className="font-mono font-medium text-foreground">
            v{appVersion}
          </span>
          <span className="mx-2 text-muted-foreground/50">&middot;</span>
          Build:{" "}
          <span className="font-mono text-foreground">{commitHash}</span>
        </p>
      </div>

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-40 rounded-lg bg-muted animate-pulse"
            />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {entries.map((entry) => (
            <Card key={entry.version}>
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <span className="font-mono">
                    {entry.version === "Unreleased"
                      ? "Unreleased"
                      : `v${entry.version}`}
                  </span>
                  {entry.version === "Unreleased" && (
                    <Badge
                      variant="secondary"
                      className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                    >
                      Planned
                    </Badge>
                  )}
                  {entry.version === appVersion && (
                    <Badge
                      variant="secondary"
                      className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                    >
                      Current
                    </Badge>
                  )}
                </CardTitle>
                {entry.date && (
                  <CardDescription>
                    Released{" "}
                    {new Date(entry.date + "T00:00:00").toLocaleDateString(
                      undefined,
                      {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      }
                    )}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                {entry.sections.map((section) => (
                  <div key={section.heading}>
                    <Badge
                      variant="secondary"
                      className={`mb-2 ${SECTION_COLORS[section.heading] || ""}`}
                    >
                      {section.heading}
                    </Badge>
                    <ul className="space-y-1 ml-1">
                      {section.items.map((item, i) => (
                        <li
                          key={i}
                          className="text-sm text-muted-foreground flex gap-2"
                        >
                          <span className="text-muted-foreground/50 select-none">
                            &bull;
                          </span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
