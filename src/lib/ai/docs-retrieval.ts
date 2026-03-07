/**
 * Docs retrieval service using ServiceNow's FluidTopics API.
 *
 * The ServiceNow docs site (servicenow.com/docs) is a JavaScript SPA, but the
 * underlying FluidTopics platform exposes a content API that returns structured
 * metadata and full HTML topic content.
 *
 * API endpoints used:
 *   GET /api/khub/maps                                 → list all publication maps
 *   GET /api/khub/maps/{mapId}/topics                  → topic tree for a map
 *   GET /api/khub/maps/{mapId}/topics/{topicId}/content → HTML content
 */

import type { FTMap, FTTopic, FetchedPage } from "./types";

const DOCS_BASE = "https://www.servicenow.com/docs";
const FETCH_TIMEOUT_MS = 15_000;
const MAX_PAGES_PER_REQUEST = 3;

// Prefer the latest releases (most likely to match current instances)
const PREFERRED_RELEASES = ["zurich", "yokohama", "xanadu", "washingtondc"];
const PREFERRED_LOCALE = "en-US";

// ── In-memory cache with TTL ────────────────────────────────────────

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry<unknown>>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const TOPIC_CONTENT_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setCache<T>(key: string, data: T, ttl = CACHE_TTL_MS): void {
  cache.set(key, { data, expiresAt: Date.now() + ttl });
}

// ── Fetch helper ────────────────────────────────────────────────────

async function ftFetch<T>(path: string): Promise<T> {
  const url = `${DOCS_BASE}${path}`;
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "NowSchemaExplorer/1.0 (catalog-evidence-retrieval)",
    },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(
      `FluidTopics API error: ${response.status} ${response.statusText} for ${path}`
    );
  }
  return response.json();
}

async function ftFetchHtml(path: string): Promise<string> {
  const url = `${DOCS_BASE}${path}`;
  const response = await fetch(url, {
    headers: {
      Accept: "text/html",
      "User-Agent": "NowSchemaExplorer/1.0 (catalog-evidence-retrieval)",
    },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(
      `FluidTopics API error: ${response.status} ${response.statusText} for ${path}`
    );
  }
  return response.text();
}

// ── Maps index ──────────────────────────────────────────────────────

interface ParsedMap {
  id: string;
  title: string;
  bundleId: string;
  family: string;
  locale: string;
  prettyUrl: string;
  readerUrl: string;
  workflow: string;
  titleLower: string;
}

async function getMapsIndex(): Promise<ParsedMap[]> {
  const cacheKey = "ft-maps-index";
  const cached = getCached<ParsedMap[]>(cacheKey);
  if (cached) return cached;

  const rawMaps = await ftFetch<FTMap[]>("/api/khub/maps");

  const parsed: ParsedMap[] = rawMaps.map((m) => {
    const meta: Record<string, string[]> = {};
    for (const entry of m.metadata) {
      meta[entry.key] = entry.values;
    }
    return {
      id: m.id,
      title: m.title,
      bundleId: (meta["bundleId"]?.[0] ?? "").toLowerCase(),
      family: (meta["family"]?.[0] ?? "").toLowerCase(),
      locale: meta["ft:locale"]?.[0] ?? "",
      prettyUrl: meta["ft:prettyUrl"]?.[0] ?? "",
      readerUrl: "",
      workflow: (meta["workflow"]?.[0] ?? "").toLowerCase(),
      titleLower: m.title.toLowerCase(),
    };
  });

  setCache(cacheKey, parsed);
  return parsed;
}

// ── Topic tree ──────────────────────────────────────────────────────

async function getTopicTree(mapId: string): Promise<FTTopic[]> {
  const cacheKey = `ft-topics-${mapId}`;
  const cached = getCached<FTTopic[]>(cacheKey);
  if (cached) return cached;

  const topics = await ftFetch<FTTopic[]>(
    `/api/khub/maps/${mapId}/topics`
  );

  setCache(cacheKey, topics);
  return topics;
}

// ── Topic content ───────────────────────────────────────────────────

async function getTopicContent(
  mapId: string,
  topicId: string
): Promise<string> {
  const cacheKey = `ft-content-${mapId}-${topicId}`;
  const cached = getCached<string>(cacheKey);
  if (cached) return cached;

  const html = await ftFetchHtml(
    `/api/khub/maps/${mapId}/topics/${topicId}/content`
  );

  setCache(cacheKey, html, TOPIC_CONTENT_CACHE_TTL_MS);
  return html;
}

// ── Discovery: find relevant maps for a table ───────────────────────

/**
 * Find candidate maps for a given table name/label.
 * Strategy: match table name keywords against map titles, bundleIds, and workflows.
 */
function findCandidateMaps(
  maps: ParsedMap[],
  tableName: string,
  tableLabel?: string
): ParsedMap[] {
  // Build search terms from table name and label
  const searchTerms = new Set<string>();

  // From table name: "incident" from "incident", "change" from "change_request"
  const nameParts = tableName.toLowerCase().split("_");
  for (const part of nameParts) {
    if (part.length >= 3) searchTerms.add(part);
  }

  // From table label: "Incident", "Change Request"
  if (tableLabel) {
    for (const part of tableLabel.toLowerCase().split(/\s+/)) {
      if (part.length >= 3) searchTerms.add(part);
    }
  }

  // Known table prefix → product area mappings
  const prefixHints: Record<string, string[]> = {
    incident: ["itsm", "it service management"],
    change: ["itsm", "it service management"],
    problem: ["itsm", "it service management"],
    kb: ["knowledge management"],
    sc: ["service catalog"],
    cmdb: ["cmdb", "configuration management"],
    sn_hr: ["hr service delivery", "human resources"],
    sys: ["platform"],
    task: ["itsm", "platform"],
    alm: ["asset management", "it asset management"],
    ast: ["asset management"],
    sla: ["service level management"],
    fm: ["facilities management"],
    csm: ["customer service management"],
    sn_customerservice: ["customer service management"],
  };

  // Add hints from prefix matching
  for (const [prefix, hints] of Object.entries(prefixHints)) {
    if (tableName.toLowerCase().startsWith(prefix)) {
      for (const hint of hints) searchTerms.add(hint);
    }
  }

  // Filter maps: English locale + preferred releases
  const englishMaps = maps.filter(
    (m) =>
      m.locale === PREFERRED_LOCALE &&
      PREFERRED_RELEASES.includes(m.family)
  );

  // Score each map
  const scored = englishMaps.map((m) => {
    let score = 0;
    for (const term of searchTerms) {
      if (m.titleLower.includes(term)) score += 3;
      if (m.bundleId.includes(term)) score += 5;
      if (m.workflow.includes(term)) score += 2;
    }
    // Prefer more recent releases
    const releaseIdx = PREFERRED_RELEASES.indexOf(m.family);
    if (releaseIdx >= 0) score += (PREFERRED_RELEASES.length - releaseIdx);
    return { map: m, score };
  });

  // Return top matches with score > 0, max 3
  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((s) => s.map);
}

// ── Discovery: find relevant topics within a map ────────────────────

interface TopicMatch {
  topic: FTTopic;
  mapId: string;
  release: string;
  score: number;
}

function searchTopicTree(
  topics: FTTopic[],
  mapId: string,
  release: string,
  tableName: string,
  tableLabel?: string
): TopicMatch[] {
  const matches: TopicMatch[] = [];
  const nameParts = tableName.toLowerCase().split("_");
  const labelLower = tableLabel?.toLowerCase() ?? "";

  // Build patterns that indicate primary field documentation for this table
  // e.g., "Create an incident", "Incident Management", "Incident fields"
  const primaryPatterns = labelLower
    ? [
        `create an ${labelLower}`,
        `create a ${labelLower}`,
        `${labelLower} management`,
        `${labelLower} fields`,
        `${labelLower} form`,
        `${labelLower} properties`,
      ]
    : [];

  function walk(topic: FTTopic) {
    const titleLower = topic.title.toLowerCase();
    let score = 0;

    // Strong boost for primary documentation patterns
    for (const pattern of primaryPatterns) {
      if (titleLower === pattern || titleLower.startsWith(pattern)) {
        score += 15;
        break;
      }
    }

    // Score by title matching
    if (labelLower && titleLower.includes(labelLower)) score += 5;
    for (const part of nameParts) {
      if (part.length >= 3 && titleLower.includes(part)) score += 2;
    }

    // Boost topics that sound like field documentation
    if (
      titleLower.includes("form") ||
      titleLower.includes("fields") ||
      titleLower.includes("configure")
    ) {
      score += 2;
    } else if (titleLower.includes("create")) {
      score += 1;
    }

    // Penalize topics that are clearly about sub-features, not the main table
    // e.g., "incident communication plan" when looking for "incident"
    if (labelLower && titleLower.includes(labelLower)) {
      const afterLabel = titleLower.slice(
        titleLower.indexOf(labelLower) + labelLower.length
      ).trim();
      // If there's substantial text after the label, it's probably a sub-feature
      if (afterLabel.length > 15) {
        score -= 3;
      }
    }

    // Boost topics with "table" context matching
    const topicMeta: Record<string, string[]> = {};
    for (const entry of topic.metadata ?? []) {
      topicMeta[entry.key] = entry.values;
    }
    const productNames = topicMeta["product_name"] ?? [];
    for (const pn of productNames) {
      if (labelLower && pn.toLowerCase().includes(labelLower)) score += 3;
    }

    if (score > 0 && topic.contentApiEndpoint) {
      matches.push({ topic, mapId, release, score });
    }

    for (const child of topic.children ?? []) {
      walk(child);
    }
  }

  for (const topic of topics) {
    walk(topic);
  }

  return matches.sort((a, b) => b.score - a.score);
}

// ── Main retrieval function ─────────────────────────────────────────

/**
 * Discover and fetch ServiceNow docs pages that may contain field definitions
 * for the given table.
 *
 * Returns up to MAX_PAGES_PER_REQUEST fetched pages with HTML content.
 */
export async function retrieveDocsPages(
  tableName: string,
  tableLabel?: string
): Promise<{ pages: FetchedPage[]; fromCache: boolean }> {
  let anyFromNetwork = false;

  try {
    // 1. Get maps index
    const maps = await getMapsIndex();
    console.log(`[docs-retrieval] Maps index: ${maps.length} maps loaded`);

    // 2. Find candidate maps for this table
    const candidateMaps = findCandidateMaps(maps, tableName, tableLabel);
    console.log(`[docs-retrieval] Candidate maps for "${tableName}": ${candidateMaps.map((m) => `${m.title} (${m.id})`).join(", ") || "none"}`);
    if (candidateMaps.length === 0) {
      return { pages: [], fromCache: false };
    }

    // 3. Search topic trees for relevant topics
    const allMatches: TopicMatch[] = [];
    for (const map of candidateMaps) {
      try {
        const topicTree = await getTopicTree(map.id);
        console.log(`[docs-retrieval] Topic tree for ${map.title}: ${topicTree.length} top-level topics`);
        const matches = searchTopicTree(
          topicTree,
          map.id,
          map.family,
          tableName,
          tableLabel
        );
        console.log(`[docs-retrieval] Topic matches in ${map.title}: ${matches.length} (top: ${matches.slice(0, 3).map((m) => `"${m.topic.title}" (score=${m.score})`).join(", ") || "none"})`);
        allMatches.push(...matches);
      } catch (err) {
        console.warn(
          `Failed to fetch topic tree for map ${map.id}:`,
          err instanceof Error ? err.message : err
        );
      }
    }

    // Sort all matches by score and take top N
    allMatches.sort((a, b) => b.score - a.score);
    const topMatches = allMatches.slice(0, MAX_PAGES_PER_REQUEST);
    console.log(`[docs-retrieval] Top ${topMatches.length} matches selected for content fetch`);

    if (topMatches.length === 0) {
      return { pages: [], fromCache: false };
    }

    // 4. Fetch content for top matching topics
    const pages: FetchedPage[] = [];
    for (const match of topMatches) {
      try {
        const html = await getTopicContent(match.mapId, match.topic.id);
        anyFromNetwork = true;

        const topicMeta: Record<string, string[]> = {};
        for (const entry of match.topic.metadata ?? []) {
          topicMeta[entry.key] = entry.values;
        }

        pages.push({
          topicId: match.topic.id,
          mapId: match.mapId,
          title: match.topic.title,
          readerUrl: match.topic.readerUrl
            ? `${DOCS_BASE}${match.topic.readerUrl}`
            : `${DOCS_BASE}/r/${match.release}`,
          html,
          release: match.release,
          locale: PREFERRED_LOCALE,
          breadcrumb: match.topic.breadcrumb ?? [],
          retrievedAt: new Date().toISOString(),
        });

        // Rate limit: small delay between fetches
        if (topMatches.indexOf(match) < topMatches.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
      } catch (err) {
        console.warn(
          `Failed to fetch topic content ${match.topic.id}:`,
          err instanceof Error ? err.message : err
        );
      }
    }

    return { pages, fromCache: !anyFromNetwork };
  } catch (err) {
    console.error(
      "Docs retrieval failed:",
      err instanceof Error ? err.message : err
    );
    return { pages: [], fromCache: false };
  }
}
