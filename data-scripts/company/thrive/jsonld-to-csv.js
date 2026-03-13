import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load your JSONL file (newline-delimited JSON - each line is a JSON object)
const filePath = path.join(
  __dirname,
  'thrive-ghl-contact-details-with-attribution-normalized.jsonld',
)
const fileContent = fs.readFileSync(filePath, 'utf8')

// Parse each line as a separate JSON object
const data = fileContent
  .split('\n')
  .filter((line) => line.trim()) // Remove empty lines
  .map((line) => JSON.parse(line))

// Flatten a nested object
function flatten(obj, prefix = '', result = {}) {
  for (const key in obj) {
    if (!obj.hasOwnProperty(key)) continue

    const newKey = prefix ? `${prefix}_${key}` : key
    const value = obj[key]

    if (value === null || value === undefined) {
      result[newKey] = ''
    } else if (Array.isArray(value)) {
      // Convert arrays to JSON string or handle as needed
      result[newKey] = JSON.stringify(value)
    } else if (typeof value === 'object') {
      flatten(value, newKey, result)
    } else {
      result[newKey] = value
    }
  }
  return result
}

// Flatten all records
const flattenedData = data.map((record) => flatten(record))

// Get all unique column names across all records
const allColumns = [
  ...new Set(flattenedData.flatMap((obj) => Object.keys(obj))),
]

// Escape CSV values
function escapeCSV(value) {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

// Build CSV
const headerRow = allColumns.map(escapeCSV).join(',')
const dataRows = flattenedData.map((record) =>
  allColumns.map((col) => escapeCSV(record[col] || '')).join(','),
)

const csv = [headerRow, ...dataRows].join('\n')

// Write to file
fs.writeFileSync(path.join(__dirname, 'output.csv'), csv)

console.log(
  `Wrote ${flattenedData.length} records with ${allColumns.length} columns`,
)
