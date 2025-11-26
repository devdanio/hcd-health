import 'dotenv/config'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '../convex/_generated/api'

const convex = new ConvexHttpClient(process.env.VITE_CONVEX_URL!)

async function runMigration() {
  console.log('Starting dateOfService migration to number...\n')

  let totalMigrated = 0
  let totalErrors = 0
  let batchNum = 0

  // Run migration in batches until complete
  while (true) {
    batchNum++
    console.log(`Running batch ${batchNum}...`)

    const result = await convex.mutation(
      api.migrations.migrateDateOfServiceToNumber,
      { batchSize: 100 },
    )

    totalMigrated += result.migratedCount
    totalErrors += result.errorCount

    console.log(
      `  Batch ${batchNum}: Migrated ${result.migratedCount}, Errors: ${result.errorCount}`,
    )

    // If this batch was smaller than batchSize, we're done
    if (!result.remaining) {
      console.log('\n✅ Migration complete!')
      break
    }

    // Small delay to avoid overwhelming the server
    await new Promise((resolve) => setTimeout(resolve, 100))
  }

  console.log(`\n📊 Final Summary:`)
  console.log(`   Total migrated: ${totalMigrated}`)
  console.log(`   Total errors: ${totalErrors}`)
  console.log(`   Batches processed: ${batchNum}`)
  console.log(
    `\n⚠️  Next steps:\n` +
      `   1. Update all code to use dateOfService instead of dateOfService\n` +
      `   2. Update schema.ts to remove dateOfService string field\n` +
      `   3. Update schema.ts to rename dateOfService -> dateOfService (as number)\n` +
      `   4. Update all code back to use dateOfService (now a number)`,
  )
}

runMigration()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Migration failed:', error)
    process.exit(1)
  })
