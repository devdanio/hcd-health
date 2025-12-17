# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a TanStack Start application using React 19, Vite, Prisma (PostgreSQL), and Tailwind CSS. The project is focused on building an attribution tracking system (High Country Health) for healthcare/chiropractic practices.

## Commands

### Development
```bash
pnpm install          # Install dependencies
pnpm dev              # Start dev server on port 3000
npx prisma studio     # Open Prisma Studio (database GUI)
npx prisma migrate dev # Run migrations
```

### Building & Testing
```bash
pnpm build            # Build for production (includes widget build)
pnpm build:widget     # Build chat widget separately
pnpm serve            # Preview production build
pnpm test             # Run all tests with Vitest
```

### Code Quality
```bash
pnpm lint             # Run ESLint
pnpm format           # Run Prettier
pnpm check            # Format and fix with both Prettier and ESLint
```

### Database
```bash
npx prisma migrate dev --name <migration-name>  # Create and apply migration
npx prisma generate                             # Generate Prisma Client
npx prisma studio                               # Open database GUI
```

### UI Components
```bash
pnpx shadcn@latest add <component-name>  # Add shadcn components
```

## Architecture

### Stack Overview
- **Frontend Framework**: React 19 + TanStack Start (file-based routing with SSR)
- **Router**: TanStack Router (v1.139.10) with file-based routes
- **Backend**: Prisma ORM + PostgreSQL + TanStack DB Collections
- **State/Data**: TanStack Query + TanStack DB
- **Auth**: Clerk (OAuth/SSO)
- **Styling**: Tailwind CSS v4 + shadcn/ui components
- **Forms**: TanStack Form
- **Testing**: Vitest + Testing Library
- **AI/LLM**: Anthropic Claude + LangChain (available for AI features)

### Project Structure

**Key Directories:**
- `src/routes/` - File-based routing (TanStack Router generates route tree)
- `src/components/` - React components (including `ui/` for shadcn components)
- `src/integrations/` - Provider setup for TanStack Query
- `src/collections/` - TanStack DB collections (data layer)
- `src/server/` - Server-side code (database client, utilities)
- `src/lib/` - Utility functions
- `src/hooks/` - Custom React hooks
- `src/generated/prisma/` - Generated Prisma Client (auto-generated, do not edit)
- `prisma/` - Database schema and migrations
- `public-components/chat-widget/` - Standalone chat widget

### Router Architecture

TanStack Router uses **file-based routing** where files in `src/routes/` automatically become routes. The router is configured in `src/router.tsx` with:
- SSR-Query integration via `setupRouterSsrQueryIntegration`
- Context containing TanStack Query client
- Route tree auto-generated in `src/routeTree.gen.ts` (do not edit manually)

**Root Layout**: `src/routes/__root.tsx` defines the shell component that wraps all routes with:
- Clerk authentication provider
- QueryClient provider
- Collections context provider
- TanStack devtools (Router + Query)

### Database & Data Layer

**Prisma Schema**: `prisma/schema.prisma` defines the database structure with PostgreSQL.

**Key Models**:
- `Company` - Multi-tenant root with Google Ads OAuth integration
- `Contact` - Unified visitor/patient identity (links to GHL/ChiroTouch)
- `GhlContact` - GoHighLevel CRM sync
- `Session` - Browser sessions with attribution tracking (UTM params, click IDs)
- `Event` - Tracking events (pageviews, conversions)
- `Patient` - Patient records linked to contacts
- `Appointment` - Appointments with service/provider relations
- `Service` & `Provider` - Practice services and providers
- `CmsPage` - CMS pages for SEO

**Prisma Client**: Generated to `src/generated/prisma/` (custom output location)
- Import: `import { prisma } from '@/server/db/client'`
- Run `npx prisma generate` after schema changes

**TanStack DB Collections**: `src/collections/` provides type-safe data collections with TanStack Query integration
- Collections are created in `__root.tsx` and accessed via `useCollections()` hook
- Each collection file (e.g., `contacts.ts`) exports:
  - Zod schemas for validation
  - Server functions for CRUD operations
  - Collection configuration with `createCollection()`
  - Helper function to create query options

**Example Collection Pattern**:
```typescript
// Create server functions
const getContacts = createServerFn({ method: 'GET' })
  .validator(getContactsSchema)
  .handler(async ({ data }) => {
    return await prisma.contact.findMany({ where: { companyId: data.companyId } })
  })

// Create collection
export const contactsCollection = createCollection({
  id: 'contacts',
  fns: {
    getContacts,
    createContact,
    updateContact,
    deleteContact,
  },
})

// Create query options helper
export const createContactsCollectionOptions = (queryClient: QueryClient) =>
  queryCollectionOptions(queryClient, contactsCollection)
```

### Authentication (Clerk)

**Setup**: Clerk provides OAuth/SSO authentication
- Environment variables required (see below)
- Provider in `__root.tsx`
- Server-side auth check in `beforeLoad` hook
- Components: `SignInButton`, `SignedIn`, `SignedOut`, `UserButton`

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
- Icon libraries: lucide-react, @tabler/icons-react

### Google Ads Integration

Google Ads OAuth tokens are stored encrypted directly in the `Company` model:
- `googleAdsAccessToken`, `googleAdsRefreshToken`
- `googleAdsCustomerId`, `googleAdsAccountName`
- Token expiration and sync tracking fields
- Uses `google-ads-api` package for API access

### External Integrations

**Available Packages**:
- `@anthropic-ai/sdk` - Anthropic Claude API
- `@langchain/anthropic` - LangChain integration
- `@gohighlevel/api-client` - GoHighLevel CRM
- `google-ads-api` - Google Ads API
- Encryption utilities in `src/server/lib/encryption.ts`

## Environment Variables

Required in `.env.local`:
```
# Database
DATABASE_URL=postgresql://...

# Clerk Auth
CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...

# Google Ads (optional)
GOOGLE_ADS_CLIENT_ID=...
GOOGLE_ADS_CLIENT_SECRET=...
GOOGLE_ADS_DEVELOPER_TOKEN=...

# Anthropic (optional, for AI features)
ANTHROPIC_API_KEY=...

# Other integrations as needed
```

## Development Workflow

1. Install dependencies: `pnpm install`
2. Set up environment variables in `.env.local`
3. Run database migrations: `npx prisma migrate dev`
4. Generate Prisma Client: `npx prisma generate`
5. Start dev server: `pnpm dev` (runs on port 3000)
6. Add shadcn components as needed: `pnpx shadcn@latest add <component>`
7. Create new routes by adding `.tsx` files to `src/routes/`
8. Define database schema in `prisma/schema.prisma` before creating migrations

## Important Notes

- **Prisma Client Location**: Generated to `src/generated/prisma/`, not the default location
- **Multi-tenant**: All data is scoped by `companyId`
- **Attribution Tracking**: Session attribution data stored as JSON (UTM params + click IDs)
- **Server Functions**: Use `createServerFn()` from `@tanstack/react-start` for server-side operations
- **Collections**: Use TanStack DB collections for type-safe data access with TanStack Query
- **Production Build**: Includes widget build step (`build:widget`)
