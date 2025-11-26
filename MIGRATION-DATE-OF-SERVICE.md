# Migration: dateOfService String → Number

This migration converts the `dateOfService` field from a string format (MM/DD/YYYY) to a Unix timestamp number.

## Migration Steps

### Step 1: Add new field and run migration

✅ **Status: Schema updated** - `dateOfService` field added to appointments table

**Run the migration:**

```bash
npx tsx data-scripts/migrate-date-of-service.ts
```

This will:

- Convert all existing `dateOfService` strings to Unix timestamps
- Store them in `dateOfService` field
- Run in batches of 100 to avoid timeouts

### Step 2: Update all code to use `dateOfService`

Update these files to use `dateOfService` instead of `dateOfService`:

- `convex/appointments.ts` - All queries and mutations
- `data-scripts/integrations/chirotouch/index.ts` - Import script
- `src/routes/companies/$companyId/appointments/index.tsx` - Frontend display
- Any other files that reference `dateOfService`

**Helper function for converting dates:**

```typescript
// Convert MM/DD/YYYY string to Unix timestamp
function dateStringToTimestamp(dateStr: string): number {
  const [month, day, year] = dateStr.split('/').map(Number)
  return new Date(year, month - 1, day).getTime()
}

// Convert Unix timestamp to MM/DD/YYYY string (for display)
function timestampToDateString(timestamp: number): string {
  const date = new Date(timestamp)
  const month = date.getMonth() + 1
  const day = date.getDate()
  const year = date.getFullYear()
  return `${month}/${day}/${year}`
}
```

### Step 3: Update schema to finalize migration

After all code uses `dateOfService`, update `convex/schema.ts`:

```typescript
export const appointments = defineTable({
  companyId: v.optional(v.id('companies')),
  contactId: v.id('contacts'),
  patientName: v.optional(v.string()),
  dateOfService: v.optional(v.number()), // ← Changed from string to number
  // Remove: dateOfService
  service: v.optional(v.string()),
  serviceId: v.optional(v.id('services')),
  providerId: v.optional(v.id('providers')),
})
```

### Step 4: Rename `dateOfService` → `dateOfService`

Update all code to use `dateOfService` again (now as a number type).

### Step 5: Clean up old data (optional)

If needed, run cleanup mutation to remove any remaining old string fields:

```typescript
await convex.mutation(api.migrations.removeOldDateOfService, {})
```

## Benefits of Number Format

- ✅ Proper date comparisons and filtering
- ✅ Easy time range calculations
- ✅ Consistent with Convex `_creationTime` field
- ✅ Better for date math (add/subtract days, etc.)
- ✅ No parsing overhead in queries

## Date Parsing Reference

**String format:** `"11/20/2025"` (MM/DD/YYYY)
**Number format:** `1732060800000` (Unix timestamp in milliseconds)

To convert:

- String → Number: `new Date(year, month - 1, day).getTime()`
- Number → String: Format using `new Date(timestamp)`
