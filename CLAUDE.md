# CLAUDE.md

Project instructions for Claude Code. These are automatically loaded when working in this repository.

## Project Overview

Now Schema Explorer is a Next.js application for exploring, comparing, and cataloging ServiceNow schemas. It supports schema ingestion via the ServiceNow Table API, interactive schema map visualization, a data catalog with AI-powered definition drafting, and role-based access control.

## Tech Stack

- **Framework**: Next.js 16 (App Router) with TypeScript
- **Database**: PostgreSQL via Prisma ORM
- **Auth**: Auth.js v5 (NextAuth) with GitHub OAuth
- **UI**: shadcn/ui components, Tailwind CSS v4, Radix UI
- **Visualization**: React Flow (@xyflow/react)
- **State**: Zustand (explorer-store.ts)
- **AI**: OpenAI SDK + Anthropic SDK (provider-agnostic via factory pattern)

## Key Commands

```bash
npm run dev          # Start dev server
npm run build        # prisma generate && next build
npm run lint         # ESLint
npx prisma migrate dev --name <name>   # Create migration
npx prisma generate  # Regenerate Prisma client
```

## Project Structure

- `src/app/(explorer)/` — Public pages (explorer, compare, catalog)
- `src/app/(admin)/admin/` — Admin pages (instances, snapshots, users, models, catalog)
- `src/app/api/` — API routes
- `src/components/` — Shared components (layout, schema-map, ui)
- `src/lib/` — Server utilities (auth, db, ai/, catalog/)
- `src/stores/` — Zustand stores
- `prisma/` — Schema and migrations

## Versioning & Changelog

This project follows [Semantic Versioning](https://semver.org/) and maintains a changelog per [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

**When making changes, always:**

1. **Update `CHANGELOG.md`** — Add entries under the `[Unreleased]` section using the appropriate category (Added, Changed, Deprecated, Removed, Fixed, Security). Every user-facing change should be documented.

2. **Before a release** — Move `[Unreleased]` entries into a new version section with today's date. Update the comparison links at the bottom of the file.

3. **Bump `package.json` version** — Keep it in sync with the latest released version.

4. **Tag releases** — After committing a version bump, create a git tag: `git tag v0.x.0`

5. **Planned features** — Items in the `[Unreleased]` section represent planned work. Keep this section current as plans evolve.

## Auth & Roles

- `ADMIN` — Full access, manages instances/snapshots/users/models
- `STEWARD` — Can edit catalog definitions, draft with AI, assign stewards
- `VIEWER` — Read-only access to explorer, compare, catalog
- `PENDING` — Newly registered, no access until admin assigns a role

## AI Definition Drafting

- Provider-agnostic client in `src/lib/ai/` (factory pattern)
- Admin configures AI models at `/admin/models`
- Draft endpoint: `POST /api/catalog/draft-definition`
- Drafts are returned for review, not saved automatically
- Source tracked as `AI_GENERATED` with model metadata

## Database Conventions

- Use `@@map("snake_case")` for table names
- Use `@map("snake_case")` for column names
- Always run `npx prisma generate` after schema changes
- Batch large operations to avoid Prisma parameter limits

## Code Patterns

- API routes use `requireAdmin()` or `requireStewardOrAdmin()` for auth
- All catalog mutations go through `auditFieldChanges()` for audit trail
- UI follows existing shadcn/ui patterns (Card, Table, Dialog, Sheet, etc.)
- Errors are handled gracefully — never throw unhandled in API routes
