import fs from 'node:fs'
import path from 'node:path'
import dayjs from 'dayjs'
import {
  getClientConfigOrThrow,
  type ClientConfig,
} from '../client-config'
import { preprocessChirotouchFile } from './ehr/chirotouch-preprocessor'
import { preprocessJasmineFile } from './ehr/jasmine-preprocessor'
import { preprocessUnifiedPracticeFile } from './ehr/unifiedpractice-preprocessor'
import {
  ensureDir,
  findLatestDatedFile,
  findLatestDatedFiles,
  parseDateTokenFromFileName,
} from './utils'
import type { PreprocessContext, PreprocessResult } from './ehr/types'

type SupportedEhr = 'chirotouch' | 'jasmine' | 'unifiedpractice'

function normalizeSourceSystem(sourceSystem: string): SupportedEhr {
  const normalized = sourceSystem
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '')
  if (normalized === 'chirotouch') return 'chirotouch'
  if (normalized === 'jasmine') return 'jasmine'
  if (normalized === 'unifiedpractice') return 'unifiedpractice'
  throw new Error(
    `Unsupported EHR system "${sourceSystem}". Supported: chirotouch, jasmine, unifiedpractice`,
  )
}

function allowedExtensionsFor(sourceSystem: SupportedEhr): string[] {
  if (sourceSystem === 'chirotouch') return ['.xls', '.xlsx']
  if (sourceSystem === 'jasmine') return ['.xls', '.xlsx']
  return ['.csv']
}

type ResolvedInputFiles = {
  filePaths: string[]
  dateToken: string | null
}

function resolveInputFilesOrThrow(
  client: ClientConfig,
  sourceSystem: SupportedEhr,
  inputFileArg?: string,
): ResolvedInputFiles {
  if (inputFileArg) {
    const parts = inputFileArg
      .split(',')
      .map((part) => part.trim())
      .filter((part) => part.length > 0)
    const filePaths = parts.map((part) => path.resolve(process.cwd(), part))
    for (const filePath of filePaths) {
      if (!fs.existsSync(filePath)) {
        throw new Error(`Input file not found: ${filePath}`)
      }
    }
    const dateTokens = filePaths
      .map((filePath) => parseDateTokenFromFileName(path.basename(filePath)))
      .filter((token): token is string => Boolean(token))
    const dateToken =
      dateTokens.length > 0
        ? dateTokens
            .map((token) => dayjs(token, 'MM-DD-YYYY', true))
            .filter((parsed) => parsed.isValid())
            .sort((a, b) => b.valueOf() - a.valueOf())[0]
            ?.format('MM-DD-YYYY') ?? null
        : null
    return { filePaths, dateToken }
  }

  if (sourceSystem === 'chirotouch') {
    const latest = findLatestDatedFiles(
      client.EHR_RAW_DIR,
      allowedExtensionsFor(sourceSystem),
      { fileNameIncludes: 'new-patients' },
    )
    if (!latest) {
      throw new Error(
        `No matching raw EHR file found in ${client.EHR_RAW_DIR}. Expected date format MM-DD-YYYY and filenames containing "new-patients".`,
      )
    }
    return { filePaths: latest.filePaths, dateToken: latest.dateToken }
  }

  const latest = findLatestDatedFile(
    client.EHR_RAW_DIR,
    allowedExtensionsFor(sourceSystem),
  )
  if (!latest) {
    throw new Error(
      `No matching raw EHR file found in ${client.EHR_RAW_DIR}. Expected date format MM-DD-YYYY.`,
    )
  }

  return { filePaths: [latest.filePath], dateToken: latest.dateToken }
}

function resolveOutputFilePath(
  client: ClientConfig,
  inputFilePaths: string[],
  sourceSystem: SupportedEhr,
  inputDateToken: string | null,
  outputFileArg?: string,
): string {
  if (outputFileArg) {
    return path.resolve(process.cwd(), outputFileArg)
  }

  if (inputFilePaths.length === 1) {
    return path.resolve(
      client.EHR_NORMALIZED_DIR,
      `${path.parse(inputFilePaths[0]).name}.patients.jsonld`,
    )
  }

  if (sourceSystem === 'chirotouch' && inputDateToken) {
    return path.resolve(
      client.EHR_NORMALIZED_DIR,
      `new-patients-${inputDateToken}.patients.jsonld`,
    )
  }

  return path.resolve(client.EHR_NORMALIZED_DIR, `patients.jsonld`)
}

function writeJsonldLines(filePath: string, values: unknown[]): void {
  const content = values.map((value) => JSON.stringify(value)).join('\n')
  fs.writeFileSync(filePath, content.length > 0 ? `${content}\n` : '')
}

function runPreprocessor(
  sourceSystem: SupportedEhr,
  inputFilePath: string,
  context: PreprocessContext,
): PreprocessResult {
  if (sourceSystem === 'chirotouch') {
    return preprocessChirotouchFile(inputFilePath, context)
  }
  if (sourceSystem === 'jasmine') {
    return preprocessJasmineFile(inputFilePath, context)
  }
  return preprocessUnifiedPracticeFile(inputFilePath, context)
}

function main() {
  const args = process.argv.slice(2)
  let clientName: string | undefined
  let inputFileArg: string | undefined
  let outputFileArg: string | undefined
  let sourceSystemArg: string | undefined

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i]
    if (arg === '--') {
      continue
    }

    if (arg === '--source-system') {
      const next = args[i + 1]
      if (!next) {
        console.error('Missing value for --source-system')
        process.exit(1)
      }
      sourceSystemArg = next
      i += 1
      continue
    }

    if (arg.startsWith('--source-system=')) {
      sourceSystemArg = arg.split('=').slice(1).join('=')
      continue
    }

    if (arg.startsWith('-')) {
      console.error(`Unknown option: ${arg}`)
      process.exit(1)
    }

    if (!clientName) {
      clientName = arg
      continue
    }

    if (!inputFileArg) {
      inputFileArg = arg
      continue
    }

    if (!outputFileArg) {
      outputFileArg = arg
      continue
    }
  }

  if (!clientName) {
    console.error(
      'Usage: pnpm exec tsx pipeline/ehr-preprocess.ts <clientName> [inputFile] [outputFile] [--source-system <name>]',
    )
    process.exit(1)
  }

  let client: ClientConfig
  try {
    client = getClientConfigOrThrow(clientName)
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  }

  const sourceSystemRaw = sourceSystemArg ?? client.EHR_SYSTEM
  let sourceSystem: SupportedEhr
  try {
    sourceSystem = normalizeSourceSystem(sourceSystemRaw)
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  }

  let resolvedInput: ResolvedInputFiles
  try {
    resolvedInput = resolveInputFilesOrThrow(
      client,
      sourceSystem,
      inputFileArg,
    )
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  }

  const outputFilePath = resolveOutputFilePath(
    client,
    resolvedInput.filePaths,
    sourceSystem,
    resolvedInput.dateToken,
    outputFileArg,
  )
  ensureDir(path.dirname(outputFilePath))
  const rejectsPath = path.resolve(
    path.dirname(outputFilePath),
    `${path.parse(outputFilePath).name}.rejects.jsonld`,
  )

  const combined: PreprocessResult = { normalized: [], rejected: [] }

  for (const inputFilePath of resolvedInput.filePaths) {
    const sourceFileName = path.basename(inputFilePath)
    const sourceFileDateToken = parseDateTokenFromFileName(sourceFileName)
    const sourceFileDate = sourceFileDateToken
      ? dayjs(sourceFileDateToken, 'MM-DD-YYYY', true).toISOString()
      : null
    const context: PreprocessContext = {
      sourceSystem,
      sourceFileName,
      sourceFileDate,
    }

    const result = runPreprocessor(sourceSystem, inputFilePath, context)
    combined.normalized.push(...result.normalized)
    combined.rejected.push(...result.rejected)
  }

  writeJsonldLines(outputFilePath, combined.normalized)
  writeJsonldLines(rejectsPath, combined.rejected)

  console.log(`Client: ${clientName}`)
  console.log(`EHR system: ${sourceSystem}`)
  console.log(`Preprocessor: ${sourceSystem}`)
  console.log(`Input files (${resolvedInput.filePaths.length}):`)
  for (const inputFilePath of resolvedInput.filePaths) {
    console.log(`- ${inputFilePath}`)
  }
  console.log(`Output: ${outputFilePath}`)
  console.log(`Rejects: ${rejectsPath}`)
  console.log(`Rows normalized: ${combined.normalized.length}`)
  console.log(`Rows rejected: ${combined.rejected.length}`)
}

main()
