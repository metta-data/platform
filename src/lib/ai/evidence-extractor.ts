/**
 * Evidence extractor: parses HTML docs pages to find field definition rows.
 *
 * ServiceNow docs pages commonly contain field description tables like:
 *   | Field             | Description                              |
 *   | Short description | Brief description of the incident.       |
 *   | Description       | Detailed explanation on the incident.    |
 *
 * This module extracts those rows and scores them by relevance to the
 * requested field.
 */

import * as cheerio from "cheerio";
import type { EvidenceSnippet, FetchedPage } from "./types";

// ── Table extraction ────────────────────────────────────────────────

interface ExtractedRow {
  header: string;        // First cell text (field name/label)
  definition: string;    // Second cell text (description)
  tableCaption: string;  // Table caption or nearest heading
  sectionHeading: string; // Nearest h2/h3 above the table
}

function extractFieldTables(html: string): ExtractedRow[] {
  const $ = cheerio.load(html);
  const rows: ExtractedRow[] = [];

  $("table").each((_tableIdx, table) => {
    const $table = $(table);

    // Get table caption
    let tableCaption =
      $table.find("caption").first().text().trim() ||
      $table.find("thead th").first().text().trim();

    // If no caption, try the nearest preceding heading
    if (!tableCaption) {
      const prevHeading = $table.prevAll("h1, h2, h3, h4").first();
      if (prevHeading.length) {
        tableCaption = prevHeading.text().trim();
      }
    }

    // Get the nearest section heading (h2 or h3)
    let sectionHeading = "";
    let el = $table.parent();
    while (el.length) {
      const heading = el.find("> h2, > h3").first();
      if (heading.length) {
        sectionHeading = heading.text().trim();
        break;
      }
      el = el.parent();
    }
    if (!sectionHeading) {
      const prevH2 = $table.prevAll("h2").first();
      if (prevH2.length) sectionHeading = prevH2.text().trim();
    }

    // Check if this looks like a field description table
    // Headers should have "Field" and "Description" (or similar)
    const headerRow = $table.find("thead tr, tr").first();
    const headerCells = headerRow
      .find("th, td")
      .map((_i, el) => $(el).text().trim().toLowerCase())
      .get();

    const hasFieldHeader = headerCells.some(
      (h) => h === "field" || h === "name" || h === "parameter"
    );
    const hasDescHeader = headerCells.some(
      (h) =>
        h === "description" ||
        h === "details" ||
        h === "definition" ||
        h === "value"
    );

    // Only process tables that look like field descriptions
    if (!hasFieldHeader || !hasDescHeader) return;

    // Find which column index is field name and which is description
    const fieldColIdx = headerCells.findIndex(
      (h) => h === "field" || h === "name" || h === "parameter"
    );
    const descColIdx = headerCells.findIndex(
      (h) =>
        h === "description" ||
        h === "details" ||
        h === "definition" ||
        h === "value"
    );

    if (fieldColIdx < 0 || descColIdx < 0) return;

    // Extract data rows (skip header)
    $table
      .find("tbody tr, tr")
      .slice(1)
      .each((_rowIdx, row) => {
        const cells = $(row).find("td, th");
        const fieldCell = cells.eq(fieldColIdx).text().trim();
        const descCell = cells.eq(descColIdx).text().trim();

        if (fieldCell && descCell) {
          rows.push({
            header: fieldCell,
            definition: descCell,
            tableCaption,
            sectionHeading,
          });
        }
      });
  });

  return rows;
}

// ── Scoring ─────────────────────────────────────────────────────────

function normalizeLabel(label: string): string {
  return label.toLowerCase().replace(/[_\s]+/g, " ").trim();
}

function scoreRow(
  row: ExtractedRow,
  fieldLabel: string,
  element: string,
  tableLabel?: string
): number {
  let score = 0;
  const rowHeaderNorm = normalizeLabel(row.header);
  const fieldLabelNorm = normalizeLabel(fieldLabel);
  const elementNorm = normalizeLabel(element);

  // Exact field label match (most important)
  if (rowHeaderNorm === fieldLabelNorm) {
    score += 10;
  } else if (rowHeaderNorm.includes(fieldLabelNorm)) {
    // Partial match — penalize if the row header is much longer
    // e.g., "Short description" matching "Description" should be penalized
    score += 4;
  } else if (fieldLabelNorm.includes(rowHeaderNorm)) {
    score += 3;
  }

  // Element name match (e.g., "short_description")
  if (rowHeaderNorm === elementNorm) {
    score += 8;
  }

  // Table caption relevance
  const captionLower = row.tableCaption.toLowerCase();
  if (
    captionLower.includes("field") ||
    captionLower.includes("description") ||
    captionLower.includes("form")
  ) {
    score += 3;
  }

  // Table label in caption (e.g., "Incident form")
  if (tableLabel && captionLower.includes(tableLabel.toLowerCase())) {
    score += 4;
  }

  // Penalize ambiguous matches where the row header is very generic
  // but doesn't exactly match our field
  if (
    rowHeaderNorm !== fieldLabelNorm &&
    (rowHeaderNorm === "description" ||
      rowHeaderNorm === "name" ||
      rowHeaderNorm === "type" ||
      rowHeaderNorm === "value")
  ) {
    score -= 5;
  }

  return score;
}

// ── Main extraction function ────────────────────────────────────────

/**
 * Extract evidence snippets from a set of fetched docs pages.
 *
 * Returns snippets ranked by relevance to the requested field.
 */
export function extractEvidence(
  pages: FetchedPage[],
  fieldLabel: string,
  element: string,
  tableLabel?: string
): EvidenceSnippet[] {
  const snippets: EvidenceSnippet[] = [];

  for (const page of pages) {
    const rows = extractFieldTables(page.html);

    for (const row of rows) {
      const score = scoreRow(row, fieldLabel, element, tableLabel);
      if (score <= 0) continue;

      snippets.push({
        text: row.definition,
        pageTitle: page.title,
        pageUrl: page.readerUrl,
        sectionHeading: row.sectionHeading || undefined,
        tableCaption: row.tableCaption || undefined,
        rowHeader: row.header,
        score,
        retrievedAt: page.retrievedAt,
      });
    }
  }

  // Sort by score descending
  snippets.sort((a, b) => b.score - a.score);

  return snippets;
}
