/**
 * Centralized prompt templates for AI-powered definition drafting.
 */

import type { EvidenceBundle, EvidenceSnippet } from "./types";

export function buildSystemPrompt(): string {
  return `You are a ServiceNow data dictionary specialist. Your task is to write clear, concise field definitions for a ServiceNow data catalog.

Rules:
- Write in the present tense, third person (e.g., "Stores the...", "Indicates whether...")
- Be specific about the field's purpose in its table context
- Keep definitions to 1-3 sentences
- Do not include the field name or label in the definition — the reader already knows which field this is
- If the field references another table, explain the relationship briefly
- Do not speculate about implementation details you are not certain about
- Return ONLY the definition text with no extra formatting, labels, or explanation`;
}

// ── Evidence-bounded prompts ────────────────────────────────────────

const WRITING_RULES = `Writing rules:
- Present tense, third person (e.g., "Stores the...", "Indicates whether...")
- 1-3 sentences, concise and specific to the field's purpose
- Do not include the field name or label in the definition
- If the field references another table, explain the relationship briefly`;

export function buildEvidenceBoundedSystemPrompt(): string {
  return `You are a ServiceNow data dictionary specialist drafting field definitions backed by official documentation evidence.

CRITICAL RULES:
- Base your definition on the provided evidence snippets ONLY
- Every claim must be directly supported by at least one evidence snippet
- Reference evidence by its index number in the citedSnippets array
- Do NOT invent, assume, or add information not present in the evidence
- If the evidence is incomplete, write the best definition you can from what is available and note any gaps

${WRITING_RULES}

You MUST return valid JSON matching this exact schema:
{
  "definition": "Your definition text here.",
  "citedSnippets": [0, 1],
  "notes": null
}

- "definition": the field definition (string, required)
- "citedSnippets": array of zero-based indices referencing which evidence snippets you used (number[], required)
- "notes": optional string noting any limitations, or null

Return ONLY the JSON object. No markdown fences, no extra text.`;
}

export function buildEvidenceBoundedUserPrompt(
  context: FieldContext,
  evidence: EvidenceBundle
): string {
  let prompt = `Write a definition for this ServiceNow field:

Table: ${context.tableName}${context.tableLabel ? ` (${context.tableLabel})` : ""}
Field name: ${context.element}
Label: ${context.label}
Type: ${context.internalType}`;

  if (context.referenceTable) {
    prompt += `\nReferences table: ${context.referenceTable}`;
  }

  prompt += `\n\nThe following evidence snippets were extracted from official ServiceNow documentation:\n`;

  for (let i = 0; i < evidence.snippets.length; i++) {
    const s = evidence.snippets[i];
    prompt += formatSnippet(i, s);
  }

  if (context.existingDefinition) {
    prompt += `\nAn existing definition also exists for reference:\n${context.existingDefinition}\n`;
  }

  prompt += `\nBase your definition on the evidence above. Return JSON only.`;
  return prompt;
}

function formatSnippet(index: number, snippet: EvidenceSnippet): string {
  let block = `\n[${index}] "${snippet.rowHeader}" — ${snippet.text}`;
  block += `\n    Source: "${snippet.pageTitle}"`;
  if (snippet.tableCaption) {
    block += ` > ${snippet.tableCaption}`;
  }
  block += "\n";
  return block;
}

export function buildNoEvidenceSystemPrompt(): string {
  return `You are a ServiceNow data dictionary specialist. No official documentation evidence was found for this field, so you must rely on your general knowledge of ServiceNow.

IMPORTANT:
- Be conservative — only state what you are confident about
- Flag any uncertainty
- Do NOT invent documentation sources or citations

${WRITING_RULES}

You MUST return valid JSON matching this exact schema:
{
  "definition": "Your definition text here.",
  "citedSnippets": [],
  "notes": "No official ServiceNow documentation found for this field."
}

Return ONLY the JSON object. No markdown fences, no extra text.`;
}

export function buildNoEvidenceUserPrompt(context: FieldContext): string {
  let prompt = `Write a definition for this ServiceNow field based on your general ServiceNow knowledge:

Table: ${context.tableName}${context.tableLabel ? ` (${context.tableLabel})` : ""}
Field name: ${context.element}
Label: ${context.label}
Type: ${context.internalType}`;

  if (context.referenceTable) {
    prompt += `\nReferences table: ${context.referenceTable}`;
  }

  if (context.existingDefinition) {
    prompt += `\n\nAn existing definition exists but may need improvement:\n${context.existingDefinition}`;
  }

  prompt += `\n\nNo official documentation was found. Use your general knowledge but be conservative. Return JSON only.`;
  return prompt;
}

export interface FieldContext {
  tableName: string;
  element: string;
  label: string;
  internalType: string;
  tableLabel?: string;
  referenceTable?: string | null;
  existingDefinition?: string | null;
}

export function buildUserPrompt(context: FieldContext): string {
  let prompt = `Write a definition for this ServiceNow field:

Table: ${context.tableName}${context.tableLabel ? ` (${context.tableLabel})` : ""}
Field name: ${context.element}
Label: ${context.label}
Type: ${context.internalType}`;

  if (context.referenceTable) {
    prompt += `\nReferences table: ${context.referenceTable}`;
  }

  if (context.existingDefinition) {
    prompt += `\n\nAn existing definition exists but may need improvement:\n${context.existingDefinition}`;
  }

  prompt += `\n\nProvide only the definition text.`;
  return prompt;
}

export function buildUserPromptWithDocs(
  context: FieldContext,
  documentation: string
): string {
  let prompt = `Write a definition for this ServiceNow field:

Table: ${context.tableName}${context.tableLabel ? ` (${context.tableLabel})` : ""}
Field name: ${context.element}
Label: ${context.label}
Type: ${context.internalType}`;

  if (context.referenceTable) {
    prompt += `\nReferences table: ${context.referenceTable}`;
  }

  prompt += `\n\nThe following official ServiceNow documentation was found for this field. Use it as a primary source, but improve clarity and conciseness if needed:\n\n${documentation}`;

  if (context.existingDefinition) {
    prompt += `\n\nAn existing definition also exists:\n${context.existingDefinition}`;
  }

  prompt += `\n\nProvide only the definition text.`;
  return prompt;
}
