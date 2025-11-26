import 'dotenv/config'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '../convex/_generated/api'

const convex = new ConvexHttpClient(process.env.VITE_CONVEX_URL!)

async function removeOldDateField() {
  console.log('Removing old dateOfService string field...\n')

  let totalRemoved = 0
  let batchNum = 0
  let cursor: string | undefined = undefined

  // Run in batches until complete
  while (true) {
    batchNum++
    console.log(`Running batch ${batchNum}...`)

    // @ts-ignore - result is not typed
    const result = await convex.mutation(
      api.migrations.removeOldDateOfServiceField,
      {
        batchSize: 1000,
        cursor,
      },
    )

    totalRemoved += result.updatedCount

    console.log(
      `  Batch ${batchNum}: Removed from ${result.updatedCount} records`,
    )

    if (result.isDone) {
      console.log('\n✅ Cleanup complete!')
      break
    }

    cursor = result.continueCursor
    await new Promise((resolve) => setTimeout(resolve, 100))
  }

  console.log(`\n📊 Summary:`)
  console.log(`   Total records cleaned: ${totalRemoved}`)
  console.log(`   Batches processed: ${batchNum}`)
}

removeOldDateField()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Cleanup failed:', error)
    process.exit(1)
  })
