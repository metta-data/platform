/**
 * Builds a ServiceNow documentation reference for a specific field.
 *
 * The ServiceNow docs site (www.servicenow.com/docs) is a JavaScript SPA
 * with no public search API, so we cannot fetch documentation text server-side.
 * Instead, we construct a direct search URL that links the user to
 * relevant documentation for the given table and field.
 *
 * Designed to never throw — always returns a result.
 */

export interface DocsSearchResult {
  text: string | null;
  url: string;
}

export function searchServiceNowDocs(
  tableName: string,
  element: string
): DocsSearchResult {
  const query = encodeURIComponent(`${tableName} ${element} field`);
  return {
    text: null,
    url: `https://www.servicenow.com/docs/search?q=${query}`,
  };
}
