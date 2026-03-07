/**
 * Shared types for the evidence-first AI definition drafting pipeline.
 */

// ── Evidence types ──────────────────────────────────────────────────

export interface EvidenceSnippet {
  /** The extracted definition text from the docs page */
  text: string;
  /** Title of the docs page */
  pageTitle: string;
  /** Resolved URL of the docs page */
  pageUrl: string;
  /** Nearest section heading above the evidence */
  sectionHeading?: string;
  /** Caption or heading of the field table */
  tableCaption?: string;
  /** The field label/name from the table row header */
  rowHeader: string;
  /** Relevance score for ranking */
  score: number;
  /** ISO timestamp of when the evidence was retrieved */
  retrievedAt: string;
}

export interface EvidenceBundle {
  /** Ranked evidence snippets found for the field */
  snippets: EvidenceSnippet[];
  /** Human-friendly docs search URL (for manual reference) */
  docsSearchUrl: string;
  /** Overall confidence in the evidence quality */
  confidence: "high" | "medium" | "low" | "none";
}

// ── FluidTopics API types ───────────────────────────────────────────

export interface FTMap {
  title: string;
  id: string;
  mapApiEndpoint: string;
  metadata: FTMetadataEntry[];
}

export interface FTMetadataEntry {
  key: string;
  label: string;
  values: string[];
}

export interface FTTopic {
  title: string;
  id: string;
  contentApiEndpoint?: string;
  readerUrl?: string;
  breadcrumb?: string[];
  metadata?: FTMetadataEntry[];
  children?: FTTopic[];
}

export interface FetchedPage {
  topicId: string;
  mapId: string;
  title: string;
  readerUrl: string;
  html: string;
  release: string;
  locale: string;
  breadcrumb: string[];
  retrievedAt: string;
}

// ── Draft result types ──────────────────────────────────────────────

export interface DraftCitation {
  /** URL to the docs page */
  url: string;
  /** Title of the docs page */
  pageTitle: string;
  /** The evidence text that was cited */
  evidenceText: string;
  /** Section heading where evidence was found */
  sectionHeading?: string;
}

export interface DraftResult {
  /** The AI-generated definition */
  definition: string;
  /** Confidence level based on evidence quality */
  confidence: "high" | "medium" | "low" | "none";
  /** Citations to source documentation */
  citations: DraftCitation[];
  /** AI model display name */
  model: string;
  /** AI model identifier */
  modelId: string;
  /** AI provider name */
  provider: string;
  /** Human-friendly docs search URL */
  docsSearchUrl: string;
  /** Optional note from the AI (e.g., "No official documentation found") */
  notes?: string | null;
  /** Token usage stats */
  usage?: { inputTokens: number; outputTokens: number };
}

// ── LLM response shape (what we ask the model to return) ────────────

export interface LLMDraftResponse {
  definition: string;
  citedSnippets: number[];
  notes: string | null;
}
