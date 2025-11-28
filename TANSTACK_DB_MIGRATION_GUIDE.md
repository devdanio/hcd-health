# TanStack DB Migration Guide

This guide explains how to migrate components from Convex to TanStack DB with REST API integration.

## Architecture Overview

- **Backend**: Prisma + PostgreSQL with TanStack Start server functions
- **Frontend**: TanStack DB with QueryCollection for reactive data management
- **Collections**: Normalized data stores that sync with REST APIs
- **Live Queries**: Reactive queries that update automatically when data changes

## Pattern Comparison

### Before (Convex)
```tsx
import { useQuery, useMutation } from 'convex/react'
import { api } from 'convex/_generated/api'

function MyComponent() {
  const companies = useQuery(api.companies.getCompanies)
  const createCompany = useMutation(api.companies.createCompany)

  const handleCreate = async () => {
    await createCompany({ name, domain })
  }
}
```

### After (TanStack DB)
```tsx
import { useLiveQuery } from '@tanstack/react-db'
import { useCollections } from '../__root'

function MyComponent() {
  const { companiesCollection } = useCollections()

  // Reactive query
  const { data: companies } = useLiveQuery((q) =>
    q.from({ company: companiesCollection })
  )

  // Optimistic mutation
  const handleCreate = () => {
    companiesCollection.insert({
      id: crypto.randomUUID(),
      name,
      domain,
      apiKey: '',
      createdAt: new Date(),
      updatedAt: new Date(),
    })
  }
}
```

## Step-by-Step Migration

### 1. Update Imports

**Remove:**
```tsx
import { useQuery, useMutation, useAction } from 'convex/react'
import { api } from 'convex/_generated/api'
import { Id } from 'convex/_generated/dataModel'
```

**Add:**
```tsx
import { useLiveQuery } from '@tanstack/react-db'
import { useCollections } from '../__root'
import { eq, gt, lt, and, or } from '@tanstack/react-db' // For filtering
```

### 2. Access Collections

```tsx
function MyComponent() {
  const {
    companiesCollection,
    contactsCollection,
    patientsCollection,
    cmsPagesCollection,
    sessionsCollection,
  } = useCollections()
}
```

### 3. Convert Queries

#### Simple Query
```tsx
// Before
const companies = useQuery(api.companies.getCompanies)

// After
const { data: companies } = useLiveQuery((q) =>
  q.from({ company: companiesCollection })
)
```

#### Query with Filtering
```tsx
// Before
const incompleteTodos = useQuery(api.todos.getIncomplete)

// After
const { data: incompleteTodos } = useLiveQuery((q) =>
  q.from({ todo: todosCollection })
   .where(({ todo }) => eq(todo.completed, false))
)
```

#### Query with Sorting
```tsx
// After
const { data: sortedItems } = useLiveQuery((q) =>
  q.from({ item: itemsCollection })
   .orderBy(({ item }) => item.createdAt, 'desc')
)
```

#### Query with Selection/Transformation
```tsx
const { data: summaries } = useLiveQuery((q) =>
  q.from({ todo: todosCollection })
   .select(({ todo }) => ({
     id: todo.id,
     summary: `${todo.text} (${todo.completed ? 'done' : 'pending'})`,
   }))
)
```

### 4. Convert Mutations

#### Insert
```tsx
// Before
const create = useMutation(api.companies.createCompany)
await create({ name, domain })

// After
companiesCollection.insert({
  id: crypto.randomUUID(),
  name,
  domain,
  apiKey: '',
  createdAt: new Date(),
  updatedAt: new Date(),
})
```

#### Update
```tsx
// Before
const update = useMutation(api.companies.updateCompany)
await update({ companyId, name, domain })

// After
companiesCollection.update(companyId, (draft) => {
  draft.name = name
  draft.domain = domain
})
```

#### Delete
```tsx
// Before
const remove = useMutation(api.companies.deleteCompany)
await remove({ companyId })

// After
companiesCollection.delete(companyId)
```

### 5. Handle Loading States

```tsx
const { data: companies, isLoading, isReady } = useLiveQuery((q) =>
  q.from({ company: companiesCollection })
)

if (isLoading) return <div>Loading...</div>
if (!isReady) return <div>Preparing data...</div>
```

### 6. Query Dependencies

When queries depend on reactive values, pass them as dependencies:

```tsx
const [minPriority, setMinPriority] = useState(5)

const { data: highPriorityTodos } = useLiveQuery(
  (q) => q.from({ todo: todosCollection })
          .where(({ todo }) => gt(todo.priority, minPriority)),
  [minPriority] // Re-run when minPriority changes
)
```

## Available Collections

All collections are available via `useCollections()`:

- **companiesCollection**: Company data
- **contactsCollection**: Contact information
- **patientsCollection**: Patient records with contact enrichment
- **cmsPagesCollection**: CMS page content
- **sessionsCollection**: Tracking sessions (read-only)

## Advanced Patterns

### Cross-Collection Joins

```tsx
const { data: patientsWithContacts } = useLiveQuery((q) =>
  q.from({
      patient: patientsCollection,
      contact: contactsCollection
    })
   .where(({ patient, contact }) =>
     eq(patient.contactId, contact.id)
   )
)
```

### Complex Filtering

```tsx
const { data: filtered } = useLiveQuery((q) =>
  q.from({ item: itemsCollection })
   .where(({ item }) =>
     and(
       eq(item.companyId, currentCompanyId),
       gt(item.priority, 5),
       or(
         eq(item.status, 'active'),
         eq(item.status, 'pending')
       )
     )
   )
)
```

## Analytics/Computed Data

For analytics or computed data (like visitor counts, revenue charts), continue using TanStack Query directly:

```tsx
import { useQuery } from '@tanstack/react-query'
import { getLast24HoursVisitors } from '@/server/functions/tracking'

const { data: visitorCount } = useQuery({
  queryKey: ['visitors24h', companyId],
  queryFn: () => getLast24HoursVisitors({ data: { companyId } }),
})
```

## Key Differences from Convex

1. **ID Fields**: Use `id` instead of `_id`
2. **Timestamps**: Use `createdAt`/`updatedAt` instead of `_creationTime`
3. **Optimistic Updates**: Mutations apply instantly, no await needed
4. **Type Safety**: Import types from Prisma client instead of Convex
5. **Server Functions**: All backend logic uses TanStack Start `createServerFn`

## Files to Migrate

Components still using Convex hooks (update these following the patterns above):

- `/src/routes/companies/$companyId/reports/appointments/index.tsx`
- `/src/components/settings/integrations-settings.tsx`
- `/src/routes/companies/$companyId/cms-pages/index.tsx`
- `/src/routes/companies/$companyId/cms-pages/create.tsx`
- `/src/routes/companies/$companyId/cms-pages/$pageId.tsx`
- `/src/components/settings/company-settings.tsx`
- `/src/components/CmsPageForm.tsx`
- `/src/components/campaign-spend-cards.tsx`
- `/src/components/ad-spend-chart.tsx`
- `/src/routes/companies/$companyId/patients/index.tsx`
- `/src/routes/companies/$companyId/patients/$patientId.tsx`
- `/src/components/PatientForm.tsx`
- `/src/routes/companies/$companyId/contacts/index.tsx`
- `/src/components/settings/providers-settings.tsx`
- `/src/components/settings/services-settings.tsx`

## Resources

- [TanStack DB Documentation](https://tanstack.com/db/latest/docs)
- [Query Collection Guide](https://tanstack.com/db/latest/docs/collections/query-collection)
- [useLiveQuery Reference](https://tanstack.com/db/latest/docs/framework/react/reference/functions/uselivequery)
- [Live Queries Guide](https://tanstack.com/db/latest/docs/guides/live-queries)
