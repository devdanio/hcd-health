import 'dotenv/config'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '../convex/_generated/api'

const convex = new ConvexHttpClient(process.env.VITE_CONVEX_URL!)

async function runRename() {
  console.log('Renaming dateOfService -> dateOfService...\n')

  let totalUpdated = 0
  let batchNum = 0

  // Run in batches until complete
  while (true) {
    batchNum++
    console.log(`Running batch ${batchNum}...`)

    const result = await convex.mutation(
      api.migrations.renameDateOfServiceField,
      { batchSize: 100 },
    )

    totalUpdated += result.updatedCount

    console.log(`  Batch ${batchNum}: Renamed ${result.updatedCount} records`)

    if (!result.remaining) {
      console.log('\n✅ Field rename complete!')
      break
    }

    await new Promise((resolve) => setTimeout(resolve, 100))
  }

  console.log(`\n📊 Summary:`)
  console.log(`   Total records updated: ${totalUpdated}`)
  console.log(`   Batches processed: ${batchNum}`)
}

runRename()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Rename failed:', error)
    process.exit(1)
  })
