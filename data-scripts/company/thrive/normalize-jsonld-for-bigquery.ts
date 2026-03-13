import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * Normalize JSONLD file for BigQuery
 *
 * This script:
 * 1. Reads a line-delimited JSON file
 * 2. Collects all unique keys across all objects
 * 3. Creates a new file where each object has all keys (with null for missing values)
 */

const getAllKeys = (inputPath: string): Set<string> => {
  const allKeys = new Set<string>()
  const fileContent = fs.readFileSync(inputPath, 'utf-8')
  const lines = fileContent.split('\n').filter((line) => line.trim())

  console.log(`Reading ${lines.length} JSON objects...`)

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!line.trim()) continue

    try {
      const obj = JSON.parse(line)
      collectKeysRecursively(obj, '', allKeys)
    } catch (error) {
      console.error(`Error parsing line ${i + 1}:`, error)
    }

    if ((i + 1) % 1000 === 0) {
      console.log(`  Processed ${i + 1}/${lines.length} objects...`)
    }
  }

  return allKeys
}

/**
 * Recursively collect all keys from nested objects
 * For nested objects, use dot notation (e.g., "attributionSource.sessionSource")
 */
const collectKeysRecursively = (
  obj: any,
  prefix: string,
  allKeys: Set<string>,
): void => {
  if (obj === null || obj === undefined) return

  if (Array.isArray(obj)) {
    // For arrays, we don't collect nested keys since BigQuery handles arrays
    return
  }

  if (typeof obj === 'object') {
    for (const key in obj) {
      const fullKey = prefix ? `${prefix}.${key}` : key
      allKeys.add(fullKey)

      // Recursively collect nested keys
      if (
        obj[key] !== null &&
        typeof obj[key] === 'object' &&
        !Array.isArray(obj[key])
      ) {
        collectKeysRecursively(obj[key], fullKey, allKeys)
      }
    }
  }
}

/**
 * Set a value in a nested object using dot notation
 * Handles cases where intermediate values might be null
 */
const setNestedValue = (obj: any, path: string, value: any): void => {
  const keys = path.split('.')
  let current = obj

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i]
    if (!(key in current) || current[key] === null || current[key] === undefined) {
      current[key] = {}
    }
    current = current[key]
  }

  current[keys[keys.length - 1]] = value
}

/**
 * Get a value from a nested object using dot notation
 */
const getNestedValue = (obj: any, path: string): any => {
  const keys = path.split('.')
  let current = obj

  for (const key of keys) {
    if (current === null || current === undefined || !(key in current)) {
      return undefined
    }
    current = current[key]
  }

  return current
}

/**
 * Normalize objects to have all keys
 */
const normalizeObjects = (
  inputPath: string,
  outputPath: string,
  allKeys: Set<string>,
): void => {
  const fileContent = fs.readFileSync(inputPath, 'utf-8')
  const lines = fileContent.split('\n').filter((line) => line.trim())

  console.log(`\nNormalizing ${lines.length} objects...`)

  // Clear output file if it exists
  if (fs.existsSync(outputPath)) {
    fs.unlinkSync(outputPath)
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!line.trim()) continue

    try {
      const obj = JSON.parse(line)
      const normalizedObj: any = {}

      // Add all keys with their values or null
      for (const key of allKeys) {
        const value = getNestedValue(obj, key)
        setNestedValue(normalizedObj, key, value !== undefined ? value : null)
      }

      // Write to output file
      fs.appendFileSync(outputPath, JSON.stringify(normalizedObj) + '\n')

      if ((i + 1) % 1000 === 0) {
        console.log(`  Normalized ${i + 1}/${lines.length} objects...`)
      }
    } catch (error) {
      console.error(`Error normalizing line ${i + 1}:`, error)
    }
  }
}

const main = () => {
  const inputPath = path.join(
    __dirname,
    'thrive-ghl-contact-details-with-attribution.jsonld',
  )
  const outputPath = path.join(
    __dirname,
    'thrive-ghl-contact-details-with-attribution-normalized.jsonld',
  )

  console.log('Step 1: Collecting all unique keys...')
  const allKeys = getAllKeys(inputPath)

  console.log(`\nFound ${allKeys.size} unique keys:`)
  const sortedKeys = Array.from(allKeys).sort()
  sortedKeys.forEach((key) => console.log(`  - ${key}`))

  console.log('\nStep 2: Normalizing all objects...')
  normalizeObjects(inputPath, outputPath, allKeys)

  console.log(`\nComplete! Normalized file saved to:`)
  console.log(outputPath)
  console.log(`\nTotal unique keys: ${allKeys.size}`)
}

main()
