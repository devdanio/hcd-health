import 'dotenv/config'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '../convex/_generated/api'
import dayjs from 'dayjs'

const convex = new ConvexHttpClient(process.env.VITE_CONVEX_URL!)

async function migrateChargeAmounts() {
  // Get companyId from command line arguments or use a default
  const companyId = process.argv[2]

  if (!companyId) {
    console.error('❌ Error: Please provide a companyId as the first argument')
    console.error('Usage: tsx data-scripts/migrateChargeAmounts.ts <companyId>')
    process.exit(1)
  }

  console.log(`Migrating charge amounts by service and date for company: ${companyId}\n`)

  // Calculate date range: today going back 5 years
  const today = dayjs().startOf('day')
  const fiveYearsAgo = today.subtract(5, 'year')

  // Calculate total number of days
  const totalDays = today.diff(fiveYearsAgo, 'day') + 1

  console.log(`Date range: ${fiveYearsAgo.format('YYYY-MM-DD')} to ${today.format('YYYY-MM-DD')}`)
  console.log(`Total days to process: ${totalDays}\n`)

  let processedDays = 0
  let totalAppointments = 0
  let totalRecordsInserted = 0
  let errors = 0

  // Loop through each day, starting from today and going backwards
  let currentDate = today

  for (let i = 0; i < totalDays; i++) {
    const dateTimestamp = currentDate.valueOf()
    const dateString = currentDate.format('YYYY-MM-DD')

    try {
      console.log(`[${i + 1}/${totalDays}] Processing ${dateString}...`)

      // @ts-ignore - result type is not fully typed
      const result = await convex.mutation(
        api.migrations.migrateChargeAmountByServiceAndDate,
        {
          companyId: companyId as any,
          date: dateTimestamp,
        },
      )

      processedDays++
      totalAppointments += result.appointmentsProcessed
      totalRecordsInserted += result.recordsInserted

      console.log(
        `  ✓ ${result.appointmentsProcessed} appointments, ${result.servicesAggregated} services, ${result.recordsInserted} records inserted\n`,
      )
    } catch (error) {
      errors++
      console.error(`  ✗ Error processing ${dateString}:`, error)
      console.error('')
    }

    // Move to previous day
    currentDate = currentDate.subtract(1, 'day')

    // Small delay to avoid overwhelming the server
    await new Promise((resolve) => setTimeout(resolve, 50))
  }

  console.log('\n📊 Migration Summary:')
  console.log(`   Days processed: ${processedDays}/${totalDays}`)
  console.log(`   Total appointments: ${totalAppointments}`)
  console.log(`   Total records inserted: ${totalRecordsInserted}`)
  console.log(`   Errors: ${errors}`)

  if (errors === 0) {
    console.log('\n✅ Migration complete!')
  } else {
    console.log('\n⚠️  Migration completed with errors')
  }
}

migrateChargeAmounts()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Migration failed:', error)
    process.exit(1)
  })
