# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Impact Graph view** — Obsidian-style force-directed graph integrated as a third view mode ("Graph") in the Schema Explorer alongside Detail and Schema Map. Visualizes table-to-table reference relationships across a snapshot. Nodes scale by connection count (degree, capped at 100px diameter), hover highlights connected neighborhood in pink, and click shows an info panel with inbound/outbound reference details and a button to switch to Detail view. Includes a filter panel with search, orphan toggle, label display toggle, and force simulation controls (link distance, repulsion strength). Force layout runs in a Web Worker to avoid blocking the main thread; slider controls are debounced for smooth interaction.
- **Interactive node dragging** — grab any node in the Impact Graph and drag it; connected nodes bounce and follow via a live main-thread d3-force simulation (Obsidian-style). Nodes settle into a new equilibrium when released and stay where you put them. The interactive simulation uses the same forces as the initial layout (link tension, charge repulsion, collision avoidance) but omits the centering force so the graph doesn't drift.
- **Focus table + depth** — clicking Graph while a table is selected auto-focuses the graph on that table, showing only N levels of connections (default: 2). Depth selector (1, 2, 3, All) in the filter panel. Focus can also be set from the node info panel via "Focus" button, or cleared to show the full graph. The focus table renders as a bright blue node with a white border, pulsing heartbeat ring animation, and triple-layer glow — unmistakable among the green scope-colored neighbors. It always renders on top (z-index 1000), has a minimum 40px diameter, and shows a bold white label. The viewport reliably auto-centers on the focus table at 1.5× zoom with a smooth 300ms animation, offset to account for the filter panel overlay. Force layout is origin-centered so the graph is visible immediately on any viewport size.
- **Smart zoom-based labels** — labels in the Impact Graph now appear progressively as you zoom in: bigger nodes (more connections) show labels at lower zoom levels, smaller nodes only when zoomed in further (Obsidian-style). Hovering always reveals the label regardless of zoom. The "Display labels" toggle overrides to force all labels visible. Labels are off by default for a cleaner initial view.
- **Canvas-based graph renderer** — replaced React Flow's DOM-based renderer with an HTML Canvas renderer for the Impact Graph. Renders 6000+ nodes and 7000+ edges in a single paint call at 60fps. Zero React re-renders during node drag — the RAF loop reads positions directly from a Map ref and repaints the canvas. Drag, hover, click, pan, and scroll-to-zoom all handled natively on canvas. Tight spherical layout via strong `forceX`/`forceY` containment (strength 0.1) with circular initial seeding and 300-tick convergence creates a dense Obsidian-style ball when zoomed out. Recenter button (crosshair icon, bottom-right) fits all nodes to viewport.
- **Hierarchy edges** — the Impact Graph now visualizes table inheritance (extends/superClass) alongside field references. Hierarchy edges render as dashed cyan lines; reference edges remain as solid pink/gray lines. The node info panel shows hierarchy connections (Extends parent / Extended by children) in a dedicated cyan-labeled section. Hierarchy edges are traversed during BFS depth filtering so parent/child tables appear naturally when exploring a focus table's neighborhood.
- **Impact analysis** — Four enhancements for analyzing field deprecation and data quality impact: (1) Directional arrowheads — reference edges now display filled arrowheads at the target node, visually indicating which table references which. Arrowheads scale with line width, match edge color, and are hidden on dimmed/very-short edges. Hierarchy edges (dashed cyan) are excluded. (2) Directional BFS traversal — when focused on a table, a Direction toggle (← In / Both / Out →) controls whether BFS follows inbound edges ("who references me?"), outbound edges ("who do I reference?"), or both. (3) Field search — the search bar now matches field element names and labels on edges, highlighting both the connected nodes (yellow stroke) and matching edges (yellow line) so you can type `caller_id` and instantly see which tables use that field. (4) Impact summary — the node info panel shows a compact "Referenced by N tables · M fields" / "References N tables · M fields" summary at the top for quick impact assessment.
- **Scope filtering** — Impact Graph filter panel now includes a collapsible "Scopes" section showing all application scopes present in the graph with colored dots matching node colors, table counts, and toggle-to-hide behavior. Click any scope row to hide/show its nodes. "All" / "None" quick toggles for bulk visibility. Header badge shows `{visible}/{total}` scope count. Reset button clears scope filter.
- **Field-level reference exploration** — Impact Graph now exposes field-level dependency details on demand. Click any node to see expandable per-edge field lists (e.g., click `sys_user` → expand `incident` → see `caller_id`, `assigned_to`, `opened_by`). Each field shows element name, label, and inherited-from table. Click any edge directly to inspect its fields in a dedicated edge info panel. "Copy fields" button copies all referencing field info to clipboard. "Fields" toggle in the filter panel draws field count badges at edge midpoints.
- **Graph performance** — drag simulation re-renders are throttled for large graphs (20fps for 500+ nodes, 30fps for 200+) while keeping d3-force physics at full 60fps speed. Pulse animation CSS is injected once instead of recreated per render. Initial zoom lowered from 1.5× to 1.0× for more context on load.
- **Reference Graph API** — `GET /api/reference-graph?snapshotId=X` returns all table-to-table reference edges for a snapshot with degree counts, orphan detection, and field-level detail per edge
- **Automated test suite** — Vitest with mocked Prisma and auth; 42 tests covering reference resolution logic, catalog API, instance connection, and snapshot endpoints
- **CI pipeline** — GitHub Actions workflow runs lint, test, and build on every PR to `main`
- **Shared reference resolution module** — extracted 4-step resolution chain (`resolveReferenceTable()`) into `src/lib/servicenow/resolve-references.ts`, reused by ingestion, diagnose-references, and repair-references endpoints

### Changed

- **Development workflow** — adopted feature-branch workflow with CI gate; documented in CLAUDE.md
- **Reference Health UI** — admin snapshots page now has a "References" button per snapshot that opens a dialog showing diagnosis results (valid, stale, unresolvable counts with a detailed table of stale entries) and one-click repair via the ServiceNow API
- **Diagnose references endpoint** — `GET /api/snapshots/[id]/diagnose-references` scans all `referenceTable` values in a snapshot and reports stale entries (labels stored instead of table names) with suggested corrections
- **Catalog → Explorer deep-links** — each catalog entry now links to its table in the Schema Explorer
  - Icon link on every catalog table row navigates to the explorer's detail view with the column highlighted
  - Dropdown in catalog detail sheet header offers "Open in Detail View" (with column highlight) and "Open in Schema Map"
  - Explorer URL now accepts `?viewMode=detail|map` and `?column=ELEMENT` params for deep-linking
  - Target column auto-scrolls into view with a brief ring highlight that fades after 3 seconds; inherited columns are auto-expanded
  - Reusable `ExplorerLink` component and `buildExplorerUrl` helper for use across the app
- **Data Classification & Sensitivity Labels** — classify catalog entries by sensitivity level (Public, Internal, Confidential, PII, PHI, PCI) with color-coded badges, severity ordering, and justification tracking
  - Classification badges on catalog entry rows and detail view
  - Classification filter dropdown in catalog list
  - Classification selector (multi-select popover) for stewards to assign/remove classifications
  - Admin page for managing classification levels (create, edit, delete custom levels; system levels protected)
  - Classification audit trail entries
  - API routes: `GET/POST /api/classifications`, `PATCH/DELETE /api/classifications/[id]`, `PATCH /api/catalog/[tableName]/[element]/classify`
- **Deprecation & Supersession** — mark catalog entries as deprecated with optional deprecation notes and links to superseding entries
  - Deprecation badge on catalog entry rows (with `opacity-60` styling for deprecated rows)
  - Deprecation banner in detail sheet with clickable link to superseding entry
  - Deprecation dialog with note input and searchable entry picker for supersession
  - Deprecation status filter (All / Active only / Deprecated only) in catalog list
  - Reverse supersession links ("Supersedes" list) shown on entries that replace deprecated ones
  - Deprecation fields audited via existing field audit trail
- **Comments & Discussion Threads** — collaborative threaded discussions on catalog entries
  - Comments tab in catalog detail sheet with count badge
  - Comment posting for authenticated users, one-level-deep threading with replies
  - Comment editing and deletion (own comments or admin)
  - Thread resolution and pinning for stewards and admins
  - Resolved threads collapsed by default with expand toggle
  - Comment count indicator on catalog entry rows
  - API routes: `GET/POST /api/catalog/[tableName]/[element]/comments`, `PATCH/DELETE /api/catalog/comments/[commentId]`, `PATCH /api/catalog/comments/[commentId]/resolve`, `PATCH /api/catalog/comments/[commentId]/pin`
- Classifications card added to admin dashboard with entry count and undefined indicator
- `classifiedCount` and `deprecatedCount` added to catalog stats API

### Fixed

- **Snowflake SQL reference resolution** — reverted API-layer normalization that incorrectly resolved `imp_user` as `IMP_USER__VIEW` via label collision; added case-insensitive label matching (Step 4) to the ingestion and repair-references resolution chains as a defensive improvement for edge-case ServiceNow instances
- **Snowflake query builder regression** — restored LEFT JOINs for reference fields that were incorrectly suppressed when the display column cache hadn't loaded yet; JOINs are now always emitted and display columns are added progressively once resolved
- Schema Map reference edges now point to the correct display column on referenced tables instead of an inherited ancestor column (e.g. "Row" from sys_metadata); convention-based columns like `name` and `number` are now checked before walking up the inheritance chain

### Changed

- Applied Mettadata Brand Color System to light and dark mode — replaced default shadcn gray palette with brand design tokens (Deep, Cobalt, Azure, Scarlet, Ice, Ink), secondary palette for data visualization (Teal, Violet, Amber, Sage, Slate), and semantic status colors
- Switched typography from Geist to brand fonts: Playfair Display (display/headlines), DM Sans (body/UI), DM Mono (code/values)
- Tag palette updated to use brand-aligned colors instead of default Tailwind palette
- Rebranded to "Mettadata Platform" — header shows "Mettadata", landing page shows "Mettadata Platform"
- Rebranded from "Now Schema Explorer" to "Metadata Explorer" to reflect multi-platform direction
- Landing page redesigned as a platform hub with cards for ServiceNow (active), Snowflake (coming soon), and Enterprise (coming soon — data assets, data products, enterprise data model, cross-platform lineage)
- CSDM page renamed from "CSDM Service Lifecycle" to "CSDM Domains" to align with official CSDM 5.0 terminology (domains are structural categories; lifecycle phases refer to implementation maturity: Crawl, Walk, Run, Fly)

### Added

- Column search/filter in the Detail View — filter own and inherited columns by name or label with live results
- Column search/filter in Schema Map nodes — compact filter input inside expanded TableNode and MiniNode for quick column lookup
- Expandable hidden columns in Schema Map — "+N more…" indicators are now clickable to reveal all columns, with "Show fewer" to collapse back
- Light/dark mode toggle in the header and landing page (uses `next-themes`, defaults to light, persists user preference)
- Dark mode uses a blue-slate tinted color palette instead of pure black for a more refined look
- Populated all CSDM lifecycle domain tables from the CSDM 5 White Paper: Design & Planning (Business Capability, Business Application, Information Object), Build & Integration (SDLC Component), Service Delivery (14 tables including Service Instance, Application Service, Technology Mgmt Service, API, AI Function/Application, and more), Service Consumption (Business Service, Business Service Offering, Service Portfolio, Request Catalog)
- Added Foundation domain tables: Contract (ast_contract), CMDB Group (cmdb_group)
- Fixed Target table name to sn_gf_goal_target per CSDM 5 specification
- CSDM table card deep-links now force detail view mode in Schema Explorer (previously could land on map view if it was last active)
- Beta badge on CSDM page title
- Self-referencing fields (e.g. Business Process → Parent) now render as a gray ghost mini-node on the Schema Map instead of being silently dropped

### Fixed

- Self-reference edges in Schema Map References view no longer disappear; they point to a synthetic ghost node so the relationship is visible
- Glossary create/edit/delete buttons now hidden for viewers; only stewards and admins see mutation controls (API was already gated)
- CSDM table cards, Foundation row, and Beta badge now render correctly in dark mode (replaced hardcoded light-only colors with dark: variants)
- Table detail view now shows a helpful message when a table is not found in the current snapshot (e.g. CSDM tables from inactive plugins) instead of a generic red error
- CSDM (Common Service Data Model) interactive view at `/csdm` with lifecycle chevron navigation
- CSDM domain table listing with clickable cards linking to Schema Explorer
- CSDM Foundation row showing cross-cutting foundational tables
- Deep-link support: CSDM table cards navigate to `/explorer?table=...` with table pre-selected
- Glossary feature at `/glossary` for tracking ServiceNow and CSDM terminology
- Glossary CRUD API (`/api/glossary`) with search and category filtering
- Glossary terms support related tables, CSDM domain linking, and category tagging
- Glossary tooltip component for showing definitions on hover (used on CSDM page)
- GlossaryTerm database model with Prisma migration
- CSDM and Glossary added to top-level navigation and landing page
- Tooltip UI component (shadcn/ui) with TooltipProvider in root layout
- Snowflake SQL query generator in the Schema Map query builder for ServiceNow data ingested via the native Snowflake connector
- Snowflake locator input (DATABASE.SCHEMA) persisted to localStorage
- Snowflake SQL uses `__VIEW` suffix per Snowflake connector naming convention
- LEFT JOIN on referenced tables via `PARSE_JSON(col):value::STRING` for reference fields in Snowflake SQL
- Auto-include display value column from referenced tables in Snowflake SQL (e.g., `ref_caller_id.NAME AS CALLER_ID__DISPLAY`)
- Batch API endpoint (`/api/tables/display-columns`) for looking up display columns across multiple tables
- Schema Map reference edges now point to the display column on the target table (e.g., `caller_id` → `name` on sys_user)
- Target MiniNodes auto-expand when a reference field is clicked, highlighting the display column row
- Display column info included in graph API response for reference target nodes
- Query builder buttons (Generate API, Query ServiceNow, Snowflake SQL) now work with no fields selected, generating open queries that return all columns (LIMIT 10)
- LEFT JOIN on SYS_CHOICE__VIEW for choice fields to resolve display labels in Snowflake SQL
- Reference-wins-over-choice rule: reference fields skip SYS_CHOICE JOINs
- Snowflake SQL API query output (planned)
- Bulk AI definition drafting (draft definitions for multiple fields at once)

### Changed

- Snowflake SQL output simplified: removed redundant table self-alias, cleaner unknown-reference hints

### Fixed

- Reference table resolution during ingestion uses 3-step chain: direct table name match → sys_id lookup → label lookup (fixes label collisions like `imp_user` vs `sys_user`)
- Added repair endpoint (`POST /api/snapshots/[id]/repair-references`) to fix reference data in-place without re-ingestion

## [0.5.0] - 2026-03-07

### Added

- Evidence-first AI drafting: retrieves official ServiceNow documentation via FluidTopics API before generating definitions
- AI definitions are now grounded in extracted field description tables from docs pages
- Confidence badges (Cited/Partial/Uncited) show evidence quality for each AI draft
- Citation panel displays extracted evidence snippets with links to source documentation
- Graceful degradation: falls back to general knowledge when no docs evidence is found
- In-memory caching of docs pages with 24-hour TTL for efficient repeat requests
- Hyperlink support in catalog definitions (auto-detects URLs and markdown-style links)
- Catalog entry tagging system with colored tag badges
- Auto-tags for definition source (Source: Manual, Source: AI, etc.) and AI confidence (Cited, Partial, Uncited)
- Auto-tags are synced automatically when definitions are saved
- Tag filter in the catalog list view
- Tag management admin page at `/admin/tags` with create, edit, delete, and color picker
- Tag selector popover for manually assigning/removing tags on catalog entries
- Tags displayed in catalog list rows and detail sheet

## [0.4.1] - 2026-03-07

### Added

- AES-256-GCM encryption for stored credentials (ServiceNow passwords and AI API keys)
- Graceful plaintext migration: existing unencrypted credentials auto-detected and encrypted on next save
- Configurable via `CREDENTIAL_ENCRYPTION_KEY` environment variable
- Version page at `/version` displaying changelog with styled version cards
- Clickable version label in header linking to version page
- CLAUDE.md project instructions with changelog maintenance rules

### Removed

- Unused `bcryptjs` dependency

## [0.4.0] - 2026-03-07

### Added

- Schema Map Query Builder for generating ServiceNow Table API calls and encoded queries
- Click-to-select fields from the Schema Map with visual highlighting
- Dot-walk field selection through reference field expansion on mini nodes
- Split left panel layout: tree navigator (top) + query builder (bottom)
- Generate API URL, cURL command, and list URL with copy-to-clipboard
- AI-powered definition drafting for data catalog fields
- Configurable AI model providers (OpenAI and Anthropic) with admin management page
- ServiceNow documentation search with graceful fallback to AI training knowledge
- "Draft with AI" button in catalog detail sheet (read and edit modes)
- AI definition source tracking and filtering in catalog
- Test connection feature for AI model configurations
- AI Models stat card on admin dashboard

## [0.3.0] - 2026-03-06

### Added

- Data catalog with snapshot provenance tracking
- Catalog enrichment from ServiceNow sys_documentation records
- Catalog enrichment from Excel file upload with preview UI
- Field-level audit trail across all catalog mutation points
- Audit history tab in catalog detail sheet
- Bulk steward assignment (selected entries and all matching filters)
- Bulk validation and unvalidation of catalog entries
- Definition source tracking (Manual, sys_documentation, Excel)
- Validation workflow with draft/validated status
- Source and validation status filter dropdowns

### Fixed

- ServiceNow enrichment JSON parse errors
- Prisma query parameter limit errors during large enrichments
- Enrichment commit failures with batch transaction processing

## [0.2.0] - 2026-03-05

### Added

- Auth.js v5 with GitHub OAuth for admin protection
- Role-based access control (Admin, Steward, Viewer, Pending)
- User management admin page with role assignment
- Graceful handling when auth environment variables are not configured

### Fixed

- Edge Runtime compatibility issue with Prisma in JWT callback
- Invalid URL error when AUTH_URL not set on Railway

## [0.1.0] - 2026-03-04

### Added

- ServiceNow schema ingestion via Table API with real-time SSE progress
- Interactive Schema Map visualization with React Flow
- Hierarchy view with inheritance chain display (straight connectors, center-aligned ancestors)
- Reference view with mini nodes for reference targets
- Click-to-highlight reference edges
- Dynamic reference field pinning (edges track expanded fields)
- Two-tier schema map display with expandable column details
- Table detail view grouped by inheritance level
- ServiceNow instance management (add, edit, delete, test connection)
- Schema snapshot management with comparison support
- Instance URL validation, auto-cleanup, and truncation
- Git commit hash display as build version
- Railway deployment support

### Fixed

- Reference edge routing and column duplication
- Layout overlap and handle positioning on node expand
- Inheritance chain and column grouping during ingestion
- Select dropdown overflowing dialog in ingestion form
- Field parsing for sysparm_display_value=all responses

[Unreleased]: https://github.com/metta-data/platform/compare/v0.5.0...HEAD
[0.5.0]: https://github.com/metta-data/platform/compare/v0.4.1...v0.5.0
[0.4.1]: https://github.com/metta-data/platform/compare/v0.4.0...v0.4.1
[0.4.0]: https://github.com/metta-data/platform/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/metta-data/platform/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/metta-data/platform/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/metta-data/platform/releases/tag/v0.1.0
