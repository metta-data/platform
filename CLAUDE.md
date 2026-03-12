# CLAUDE.md

Project instructions for Claude Code. These are automatically loaded when working in this repository.

## Project Overview

Mettadata Platform is a Next.js application for exploring, comparing, and cataloging schemas across technology platforms. It supports schema ingestion via the ServiceNow Table API, interactive schema map visualization, a data catalog with AI-powered definition drafting, and role-based access control.

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
npm test             # Run tests (vitest)
npm run test:watch   # Run tests in watch mode
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

1. **Update `CHANGELOG.md` in every commit** — Add entries under the `[Unreleased]` section as part of the same commit that introduces the change. Use the appropriate category (Added, Changed, Deprecated, Removed, Fixed, Security). Every user-facing change should be documented. Do not defer changelog updates to a later commit.

2. **Before a release** — Move `[Unreleased]` entries into a new version section with today's date. Update the comparison links at the bottom of the file.

3. **Bump `package.json` version** — Keep it in sync with the latest released version.

4. **Tag releases** — After committing a version bump, create a git tag: `git tag v0.x.0`

5. **Planned features** — Items in the `[Unreleased]` section may include planned work that is not yet implemented. Keep this section current as plans evolve.

## GitHub Issues

All features and bugs are tracked as GitHub Issues. This provides a searchable history of what was built, what broke, and how it was resolved.

**When making changes, always:**

1. **Create a GitHub Issue for every feature or bug** — before or during implementation. Use a clear title and include a Summary section describing the problem or feature.

2. **Apply labels** — use `bug` or `enhancement` plus an area label:
   - `area: catalog` — Data Catalog features
   - `area: explorer` — Schema Explorer & Map features
   - `area: query-builder` — SQL query builder (ServiceNow & Snowflake)
   - `area: ingestion` — ServiceNow data ingestion
   - `area: auth` — Authentication & authorization

3. **Reference issues in commits** — use `Fixes #N` or `Resolves #N` in commit messages to auto-close issues.

4. **Close issues when resolved** — include the commit hash in the issue body for traceability.

**CLI quick reference:**
```bash
gh issue create --title "..." --label "bug" --label "area: catalog" --body "..."
gh issue close N --reason completed
gh issue list --state open
```

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

## Development Workflow

- **Feature branches** — Work on `feat/` or `fix/` branches, merge to `main` via PR
- **CI checks** — GitHub Actions runs lint, test, and build on every PR to `main`
- **Local verification** — Before pushing, run `npm run lint && npm test && npm run build`
- **Railway deploys from `main`** — Only merged PRs reach production
- **Rollback** — Use `git revert` for code issues; Railway dashboard for instant rollback to previous deploy

## Testing

- **Framework**: Vitest with mocked Prisma and auth
- **Test location**: `src/__tests__/` (mirrors src structure)
- **Mock setup**: `src/__tests__/setup.ts` provides `mockPrisma`, `mockUnauthorized()`, `mockAdminSession()`, `mockStewardSession()`, `mockViewerSession()`
- **Regression-first rule**: When a bug is found in production, write a test that reproduces it before fixing
- **Reference resolution**: Shared logic in `src/lib/servicenow/resolve-references.ts` — used by ingestion, diagnose-references, and repair-references endpoints

## Code Patterns

- API routes use `requireAdmin()` or `requireStewardOrAdmin()` for auth
- All catalog mutations go through `auditFieldChanges()` for audit trail
- UI follows existing shadcn/ui patterns (Card, Table, Dialog, Sheet, etc.)
- Errors are handled gracefully — never throw unhandled in API routes
