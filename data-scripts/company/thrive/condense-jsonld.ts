import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * Condense JSONLD file to extract only specific properties
 *
 * Extracts: attributionSource, createdBy, dateAdded, dateUpdated, email, phone
 */

const main = () => {
  const inputPath = path.join(
    __dirname,
    'thrive-ghl-contact-details-with-attribution.jsonld',
  )
  const outputPath = path.join(
    __dirname,
    'thrive-ghl-contact-details-with-attribution-condensed.jsonld',
  )

  const fileContent = fs.readFileSync(inputPath, 'utf-8')
  const lines = fileContent.split('\n').filter((line) => line.trim())

  console.log(`Processing ${lines.length} JSON objects...`)

  // Clear output file if it exists
  if (fs.existsSync(outputPath)) {
    fs.unlinkSync(outputPath)
  }

  let processedCount = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!line.trim()) continue

    try {
      const obj = JSON.parse(line)

      // Extract only the specified properties
      const condensed: Record<string, any> = {}

      condensed.attributionSource = obj.attributionSource ?? {}

      condensed.createdBy = obj.createdBy ?? ''

      condensed.dateAdded = obj.dateAdded ?? ''

      condensed.dateUpdated = obj.dateUpdated ?? ''

      condensed.email = obj.email ?? ''

      condensed.phone = obj.phone ?? ''

      condensed.lastAttributionSource = obj.lastAttributionSource ?? {}

      // Write to output file
      const jsonLine = JSON.stringify(condensed)
      fs.appendFileSync(outputPath, jsonLine + '\n')

      processedCount++

      if ((i + 1) % 1000 === 0) {
        console.log(`  Processed ${i + 1}/${lines.length} objects...`)
      }
    } catch (error) {
      console.error(`Error processing line ${i + 1}:`, error)
    }
  }

  console.log(`\nComplete! Processed ${processedCount} objects`)
  console.log(`Condensed file saved to:`)
  console.log(outputPath)

  // Show file size comparison
  const originalSize = fs.statSync(inputPath).size
  const condensedSize = fs.statSync(outputPath).size
  const reduction = ((1 - condensedSize / originalSize) * 100).toFixed(1)

  console.log(`\nFile size comparison:`)
  console.log(`  Original: ${(originalSize / 1024 / 1024).toFixed(2)} MB`)
  console.log(`  Condensed: ${(condensedSize / 1024 / 1024).toFixed(2)} MB`)
  console.log(`  Reduction: ${reduction}%`)
}

main()
