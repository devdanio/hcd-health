# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev              # Start dev server (port 3000)
pnpm build            # Prisma generate → Vite build → build tracker
pnpm test             # Run Vitest
pnpm lint             # ESLint
pnpm check            # Prettier write + ESLint fix

# Database
pnpm db:generate      # Generate Prisma client
pnpm db:push          # Push schema to dev database
pnpm db:push:prod     # Push schema to production database
pnpm db:migrate       # Run Prisma migrations
pnpm db:studio        # Open Prisma Studio

# Shadcn
pnpm dlx shadcn@latest add <component>

# Data pipeline scripts
pnpm exec tsx src/integrations/patients/patients-to-db.ts <clientName> <filePath> [--source ehr]
pnpm exec tsx src/integrations/chirotouch/proccess-new-patients-excel.ts
```

## Architecture

**TanStack Start** full-stack React 19 app with Nitro SSR. TypeScript strict mode, ES modules.

### Routing
- File-based routing in `src/routes/`
- Route tree auto-generated in `src/routeTree.gen.ts` — do not edit manually
- API routes at `src/routes/api/` (`.ts` extension): `ingest/events.ts`, `internal/google-ads/sync.ts`, `internal/facebook-ads/sync.ts`
- Root layout: `src/routes/__root.tsx`

### Data Fetching
- Server data via `createServerFn` (from `@tanstack/react-start`) — these are the server functions
- TanStack Query for client-side caching and fetching
- Main server functions: `src/server/ri/serverFns.ts` — uses `createServerFn` + Zod input validation

### Auth
- Clerk via `@clerk/tanstack-react-start`
- Org-scoped auth guard: `requireActiveOrganizationFromAuth()` in `src/server/ri/orgContext.ts`
- All authenticated endpoints must verify org membership before querying

### Database
- **Prisma 7** with PostgreSQL via `@prisma/adapter-pg`
- Schema: `prisma/schema.prisma`
- Generated client: `src/generated/prisma/`
- Singleton: `src/db.ts` — import as `import { prisma } from '@/db'`
- **Multi-tenant**: Every table has `organization_id`. All queries must scope by it.

### Environment
- Type-safe env via Zod in `src/env.ts` — import as `import { env } from '@/env'`
- Server vars: no prefix required
- Client vars: must use `VITE_` prefix
- Default env file: `.env.prod` for data scripts, `.env` for dev

### UI
- Shadcn UI (new-york style, zinc base color) in `src/components/ui/`
- Tailwind CSS v4
- Icons: Lucide React
- Forms: TanStack Form

### Path Alias
- `@/` → `src/`

## Key Patterns

### Server Functions
```typescript
import { createServerFn } from '@tanstack/react-start'
const myFn = createServerFn({ method: 'GET' })
  .validator(zodSchema)
  .handler(async ({ data }) => { ... })
```

### Data Pipeline (`src/integrations/`)
- `chirotouch/` — ChiroTouch EHR Excel parser (xlsx → JSON)
- `ghl/` — GoHighLevel CRM integration
- `patients/patients-to-db.ts` — Batch upsert patients from `.jsonld` (line-delimited) or `.json` (array from ChiroTouch parser)
- Client config: `client-config.ts` maps client names (e.g. `thrive`) to org IDs and API-key env var names

### Public Components
Standalone packages in `public-components/` with their own `package.json` and `node_modules`:
- `tracker/` — Preact analytics tracker, built as IIFE bundle to `public/scripts/tracker/tracker.js` via `pnpm build:tracker`
- `chat-widget/` — Embeddable chat interface

## Coding Conventions

- TypeScript only, never use `any`
- `dayjs` for all date handling
- Prisma model names: plural, lowercase, snake_case (e.g. `lead_events`, `patient_sources`)
- Zod (v4) for all validation
- Files prefixed with `demo` are starter examples and can be deleted

## Restrictions

- Never analyze `data-scripts/` or `temp-data/` unless explicitly asked
