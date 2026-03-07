# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Snowflake and SQL query generator for ServiceNow data ingested via the native Snowflake ServiceNow connector
- Bulk AI definition drafting (draft definitions for multiple fields at once)
- Hyperlink support in catalog definitions (auto-detects URLs and markdown-style links)
- Evidence-first AI drafting: retrieves official ServiceNow documentation via FluidTopics API before generating definitions
- AI definitions are now grounded in extracted field description tables from docs pages
- Confidence badges (Cited/Partial/Uncited) show evidence quality for each AI draft
- Citation panel displays extracted evidence snippets with links to source documentation
- Graceful degradation: falls back to general knowledge when no docs evidence is found
- In-memory caching of docs pages with 24-hour TTL for efficient repeat requests

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

[Unreleased]: https://github.com/andy-mott/now-schema-explorer/compare/v0.4.1...HEAD
[0.4.1]: https://github.com/andy-mott/now-schema-explorer/compare/v0.4.0...v0.4.1
[0.4.0]: https://github.com/andy-mott/now-schema-explorer/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/andy-mott/now-schema-explorer/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/andy-mott/now-schema-explorer/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/andy-mott/now-schema-explorer/releases/tag/v0.1.0
