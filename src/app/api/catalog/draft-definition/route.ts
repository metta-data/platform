import { NextResponse } from "next/server";
import { requireStewardOrAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getActiveAIClient } from "@/lib/ai/factory";
import {
  buildEvidenceBoundedSystemPrompt,
  buildEvidenceBoundedUserPrompt,
  buildNoEvidenceSystemPrompt,
  buildNoEvidenceUserPrompt,
  type FieldContext,
} from "@/lib/ai/prompts";
import { searchServiceNowDocs } from "@/lib/ai/docs-search";
import { retrieveDocsPages } from "@/lib/ai/docs-retrieval";
import { extractEvidence } from "@/lib/ai/evidence-extractor";
import { parseAIResponse } from "@/lib/ai/response-parser";
import type { EvidenceBundle } from "@/lib/ai/types";

export async function POST(request: Request) {
  const session = await requireStewardOrAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { tableName, element } = body;

  if (!tableName || !element) {
    return NextResponse.json(
      { error: "tableName and element are required" },
      { status: 400 }
    );
  }

  // 1. Load the catalog entry for full context
  const entry = await prisma.catalogEntry.findUnique({
    where: { tableName_element: { tableName, element } },
  });

  if (!entry) {
    return NextResponse.json(
      { error: "Catalog entry not found" },
      { status: 404 }
    );
  }

  try {
    // 2. Get the active AI client
    const { client, modelConfig } = await getActiveAIClient();

    // 3. Build human-friendly docs search URL
    const docsRef = searchServiceNowDocs(tableName, element);

    // 4. Look up the table label from the snapshot for better docs discovery
    const snapshotTable = await prisma.snapshotTable.findFirst({
      where: {
        snapshotId: entry.sourceSnapshotId,
        name: tableName,
      },
      select: { label: true },
    });
    const tableLabel = snapshotTable?.label;

    // 5. Gather evidence from ServiceNow documentation
    console.log(`[draft] Retrieving docs for ${tableName} (label: ${tableLabel ?? "unknown"})...`);
    const { pages } = await retrieveDocsPages(tableName, tableLabel ?? undefined);
    console.log(`[draft] Retrieved ${pages.length} page(s) for ${tableName}`);
    const snippets = extractEvidence(pages, entry.label, element, tableLabel ?? undefined);
    console.log(`[draft] Extracted ${snippets.length} evidence snippet(s) for ${element}`);

    // Determine confidence from evidence quality
    let confidence: EvidenceBundle["confidence"] = "none";
    if (snippets.length > 0) {
      const topScore = snippets[0].score;
      if (topScore >= 10) confidence = "high";
      else if (topScore >= 6) confidence = "medium";
      else confidence = "low";
    }

    const evidence: EvidenceBundle = {
      snippets: snippets.slice(0, 5), // Limit to top 5 snippets for the prompt
      docsSearchUrl: docsRef.url,
      confidence,
    };

    // 6. Build prompts based on evidence availability
    const fieldContext: FieldContext = {
      tableName,
      element,
      label: entry.label,
      internalType: entry.internalType,
      tableLabel: tableLabel ?? undefined,
      existingDefinition: entry.definition,
    };

    let systemPrompt: string;
    let userPrompt: string;

    if (evidence.confidence !== "none") {
      systemPrompt = buildEvidenceBoundedSystemPrompt();
      userPrompt = buildEvidenceBoundedUserPrompt(fieldContext, evidence);
    } else {
      systemPrompt = buildNoEvidenceSystemPrompt();
      userPrompt = buildNoEvidenceUserPrompt(fieldContext);
    }

    // 7. Call the AI model
    const response = await client.complete({
      systemPrompt,
      userPrompt,
      maxTokens: 800,
      temperature: 0.2,
    });

    // 8. Parse structured response
    const parsed = parseAIResponse(response.content, evidence);

    // 9. Return enriched result
    return NextResponse.json({
      definition: parsed.definition,
      confidence: parsed.confidence,
      citations: parsed.citations,
      notes: parsed.notes,
      model: modelConfig.name,
      modelId: modelConfig.modelId,
      provider: modelConfig.provider,
      docsUrl:
        parsed.citations.length > 0
          ? parsed.citations[0].url
          : docsRef.url,
      usage: response.usage,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "AI definition drafting failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
