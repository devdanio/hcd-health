# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a TanStack Start application using React 19, Vite, Convex (backend), and Tailwind CSS. The project is focused on building an attribution tracking system (Leadalytics).

## Commands

### Development
```bash
pnpm install          # Install dependencies
pnpm dev              # Start dev server on port 3000
npx convex dev        # Start Convex backend (run in separate terminal)
```

### Building & Testing
```bash
pnpm build            # Build for production
pnpm serve            # Preview production build
pnpm test             # Run all tests with Vitest
```

### Code Quality
```bash
pnpm lint             # Run ESLint
pnpm format           # Run Prettier
pnpm check            # Format and fix with both Prettier and ESLint
```

### UI Components
```bash
pnpx shadcn@latest add <component-name>  # Add shadcn components
```

## Architecture

### Stack Overview
- **Frontend Framework**: React 19 + TanStack Start (file-based routing with SSR)
- **Router**: TanStack Router (v1.132.0) with file-based routes
- **Backend**: Convex (real-time database and serverless functions)
- **Styling**: Tailwind CSS v4 + shadcn/ui components
- **State/Data**: TanStack Query + Convex React Query integration
- **Forms**: TanStack Form
- **Testing**: Vitest + Testing Library

### Project Structure

**Key Directories:**
- `src/routes/` - File-based routing (TanStack Router generates route tree)
- `src/components/` - React components (including `ui/` for shadcn components)
- `src/integrations/` - Provider setup for Convex and TanStack Query
- `src/lib/` - Utility functions
- `src/hooks/` - Custom React hooks
- `convex/` - Backend schema and serverless functions

### Router Architecture

TanStack Router uses **file-based routing** where files in `src/routes/` automatically become routes. The router is configured in `src/router.tsx` with:
- SSR-Query integration via `setupRouterSsrQueryIntegration`
- Context containing TanStack Query client
- Route tree auto-generated in `src/routeTree.gen.ts` (do not edit manually)

**Root Layout**: `src/routes/__root.tsx` defines the shell component that wraps all routes with:
- Convex provider
- Header component
- TanStack devtools (Router + Query)

### Convex Integration

Convex provides real-time database and serverless backend:

**Setup Requirements:**
- Environment variables: `VITE_CONVEX_URL` and `CONVEX_DEPLOYMENT` in `.env.local`
- Run `npx convex init` to auto-configure, or `npx convex dev` to start

**Provider Setup**: `src/integrations/convex/provider.tsx` wraps the app with ConvexProvider, using `ConvexQueryClient` for TanStack Query integration.

**Schema Location**: `convex/schema.ts` - defines database tables using Convex schema builder

### Convex Schema Guidelines (from .cursorrules)

When designing schemas:

**System Fields** (auto-generated, no need to define):
- `_id`: Document ID
- `_creationTime`: Creation timestamp in ms since Unix epoch

**Validator Types** (use `v` from `convex/values`):
```typescript
v.id("tableName")     // Reference to another table
v.string()
v.number()            // or v.float64()
v.bigint()            // or v.int64()
v.boolean()
v.array(element)
v.object({ fields })
v.union(...)
v.optional(value)
v.literal(value)
```

**Index Definition**: Add `.index("indexName", ["field1", "field2"])` after `defineTable()`

**Example Schema Pattern**:
```typescript
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  tableName: defineTable({
    field: v.string(),
    userId: v.id("users"),
    optional: v.optional(v.string()),
  }).index("userId", ["userId"]),
});
```

### TypeScript Configuration

**Path Aliases**: `@/*` maps to `src/*` (configured in `tsconfig.json`)
- Import like: `import { Button } from "@/components/ui/button"`
- Enabled via `vite-tsconfig-paths` plugin

**Strict Mode**: Enabled with unused locals/parameters checks

### Styling

**Tailwind CSS v4**: Configured via `@tailwindcss/vite` plugin
- Main styles: `src/styles.css`
- Uses CSS variables for theming (zinc base color)

**shadcn/ui**: Component library with "new-york" style
- Components in: `src/components/ui/`
- Icon library: lucide-react

### Demo Files

Files prefixed with `demo` in routes and components can be safely deleted. They demonstrate features like:
- SSR modes (full SSR, SPA mode, data-only)
- API requests
- Server functions
- Convex integration
- TanStack Query usage
- Form handling
- Table components

## Environment Variables

Required in `.env.local`:
```
VITE_CONVEX_URL=<your-convex-url>
CONVEX_DEPLOYMENT=<your-deployment>
```

Run `npx convex init` to generate automatically.

## Development Workflow

1. Start Convex backend: `npx convex dev`
2. Start dev server: `pnpm dev` (runs on port 3000)
3. Add shadcn components as needed: `pnpx shadcn@latest add <component>`
4. Define schema in `convex/schema.ts` before creating queries/mutations
5. Routes auto-generate from files in `src/routes/` - create `.tsx` files there for new pages
