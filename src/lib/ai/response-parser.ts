/**
 * Parses structured JSON responses from the LLM with graceful fallback.
 *
 * The LLM is instructed to return JSON like:
 *   { "definition": "...", "citedSnippets": [0, 1], "notes": null }
 *
 * If the model returns invalid JSON (markdown fences, plain text, etc.),
 * the raw text is used as the definition with "none" confidence.
 */

import type {
  DraftCitation,
  EvidenceBundle,
  LLMDraftResponse,
} from "./types";

interface ParsedResponse {
  definition: string;
  citations: DraftCitation[];
  confidence: "high" | "medium" | "low" | "none";
  notes: string | null;
}

/**
 * Parse the raw LLM output and map it back to evidence snippets.
 */
export function parseAIResponse(
  rawContent: string,
  evidence: EvidenceBundle
): ParsedResponse {
  const cleaned = stripMarkdownFences(rawContent.trim());

  // Try parsing as JSON
  let parsed: LLMDraftResponse | null = null;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    // Not valid JSON — fall through to plain text fallback
  }

  // Validate the parsed shape
  if (parsed && typeof parsed.definition === "string" && parsed.definition) {
    const citations = mapSnippetIndicesToCitations(
      parsed.citedSnippets ?? [],
      evidence
    );

    // Determine confidence from evidence + citations
    let confidence = evidence.confidence;
    if (citations.length === 0 && confidence !== "none") {
      confidence = "low";
    }

    return {
      definition: parsed.definition.trim(),
      citations,
      confidence,
      notes: parsed.notes ?? null,
    };
  }

  // Fallback: use raw text as definition
  return {
    definition: extractPlainDefinition(rawContent),
    citations: [],
    confidence: "none",
    notes: "AI response was not in the expected format; using raw text.",
  };
}

/**
 * Strip markdown code fences from the response.
 * Models sometimes wrap JSON in ```json ... ``` blocks.
 */
function stripMarkdownFences(text: string): string {
  // Match ```json\n...\n``` or ```\n...\n```
  const fenceMatch = text.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/);
  if (fenceMatch) return fenceMatch[1].trim();

  // Also handle case where text starts with ``` but doesn't end with it
  if (text.startsWith("```")) {
    const stripped = text.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```$/, "");
    return stripped.trim();
  }

  return text;
}

/**
 * Map cited snippet indices to DraftCitation objects.
 */
function mapSnippetIndicesToCitations(
  indices: number[],
  evidence: EvidenceBundle
): DraftCitation[] {
  if (!Array.isArray(indices)) return [];

  const citations: DraftCitation[] = [];
  const seen = new Set<string>();

  for (const idx of indices) {
    if (typeof idx !== "number" || idx < 0 || idx >= evidence.snippets.length) {
      continue;
    }
    const snippet = evidence.snippets[idx];
    // Deduplicate by URL + text
    const key = `${snippet.pageUrl}::${snippet.text}`;
    if (seen.has(key)) continue;
    seen.add(key);

    citations.push({
      url: snippet.pageUrl,
      pageTitle: snippet.pageTitle,
      evidenceText: snippet.text,
      sectionHeading: snippet.sectionHeading,
    });
  }

  return citations;
}

/**
 * Extract a plain definition from raw text that isn't valid JSON.
 * Removes common LLM artifacts like labels and quotes.
 */
function extractPlainDefinition(text: string): string {
  let cleaned = text.trim();

  // Remove "Definition:" or similar prefixes
  cleaned = cleaned.replace(
    /^(?:definition|def|answer|result|output)\s*:\s*/i,
    ""
  );

  // Remove surrounding quotes
  if (
    (cleaned.startsWith('"') && cleaned.endsWith('"')) ||
    (cleaned.startsWith("'") && cleaned.endsWith("'"))
  ) {
    cleaned = cleaned.slice(1, -1);
  }

  return cleaned.trim();
}
