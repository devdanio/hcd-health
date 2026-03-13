import { runTsxScript } from './utils'

async function main() {
  const args = process.argv.slice(2)
  await runTsxScript(['src/integrations/ghl/fetch-all-contacts.ts', ...args])
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
