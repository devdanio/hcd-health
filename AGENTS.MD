# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm run dev          # Start dev server on port 3000
pnpm run build        # Build for production
pnpm run test         # Run all tests with Vitest
pnpm run lint         # Run ESLint
pnpm run format       # Run Prettier
pnpm run check        # Format and lint fix

# Database (Prisma with PostgreSQL)
pnpm run db:generate  # Generate Prisma client
pnpm run db:push      # Push schema to database
pnpm run db:migrate   # Run migrations
pnpm run db:studio    # Open Prisma Studio
pnpm run db:seed      # Seed database
```

Add Shadcn components:

```bash
pnpm dlx shadcn@latest add <component>
```

## Architecture

**TanStack Start** full-stack React framework with SSR support via Nitro server.

### Routing

- File-based routing in `src/routes/`
- Route files export a `Route` created with `createRoute()` or `createFileRoute()`
- Root layout at `src/routes/__root.tsx` wraps all routes
- API routes use `.ts` extension (e.g., `api.names.ts`)
- Route tree auto-generated in `src/routeTree.gen.ts`

### Data Layer

- **TanStack Query** for client-side data fetching and caching
- Router context includes `queryClient` for SSR integration
- Data from the server should always be served using createServerFn (from `import { createServerFn } from '@tanstack/react-start'` )
- Use Tanstack Query for all data fetching and caching

### Coding

- Always use Typescript
- Never use "any"
- Use dayjs for any and all date values

### Database

- **Prisma** ORM with PostgreSQL via `@prisma/adapter-pg`
- Schema at `prisma/schema.prisma`
- Generated client outputs to `src/generated/prisma/`
- Database client singleton in `src/db.ts`
- Model names should always be plural, lowercase and snake_case. Never use CamelCase.
- Environment uses `.env.local` for database connection

### Environment Variables

- Type-safe env vars via T3Env in `src/env.ts`
- Server vars: no prefix required
- Client vars: must use `VITE_` prefix
- Import as `import { env } from "@/env"`

### Path Aliases

- `@/` maps to `src/` directory

### UI Components

- Shadcn UI components in `src/components/ui/`
- Tailwind CSS v4 for styling
- TanStack Form for form handling

### Demo Files

Files prefixed with `demo` are starter examples and can be deleted.
