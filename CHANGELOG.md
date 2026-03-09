# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

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

[Unreleased]: https://github.com/andy-mott/now-schema-explorer/compare/v0.5.0...HEAD
[0.5.0]: https://github.com/andy-mott/now-schema-explorer/compare/v0.4.1...v0.5.0
[0.4.1]: https://github.com/andy-mott/now-schema-explorer/compare/v0.4.0...v0.4.1
[0.4.0]: https://github.com/andy-mott/now-schema-explorer/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/andy-mott/now-schema-explorer/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/andy-mott/now-schema-explorer/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/andy-mott/now-schema-explorer/releases/tag/v0.1.0
