import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import dayjs from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat'

dayjs.extend(customParseFormat)

const DATE_TOKEN_REGEX =
  /\b(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])-(20\d{2})\b/

export type LatestFileSelection = {
  filePath: string
  dateToken: string
}

export type LatestFilesSelection = {
  filePaths: string[]
  dateToken: string
}

type FileMatchOptions = {
  fileNamePrefix?: string
  fileNameIncludes?: string
}

type DatedFileCandidate = {
  fileName: string
  filePath: string
  dateToken: string
  dateValue: number
  mtimeMs: number
}

export function buildRunId(): string {
  return dayjs().format('MM-DD-YYYY-HHmmss')
}

export function ensureDir(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true })
}

export function parseDateTokenFromFileName(fileName: string): string | null {
  const match = fileName.match(DATE_TOKEN_REGEX)
  if (!match) return null
  const token = match[0]
  const parsed = dayjs(token, 'MM-DD-YYYY', true)
  return parsed.isValid() ? token : null
}

function listDatedCandidates(
  directoryPath: string,
  allowedExtensions: string[],
  options?: FileMatchOptions,
): DatedFileCandidate[] {
  if (!fs.existsSync(directoryPath)) return []

  const normalizedPrefix = options?.fileNamePrefix?.trim().toLowerCase() ?? ''
  const normalizedIncludes = options?.fileNameIncludes?.trim().toLowerCase() ?? ''

  const files = fs
    .readdirSync(directoryPath, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((fileName) => {
      const lower = fileName.toLowerCase()
      if (normalizedPrefix && !lower.startsWith(normalizedPrefix)) return false
      if (normalizedIncludes && !lower.includes(normalizedIncludes)) return false
      const ext = path.extname(fileName).toLowerCase()
      return allowedExtensions.includes(ext)
    })

  const candidates: DatedFileCandidate[] = []
  for (const fileName of files) {
    const token = parseDateTokenFromFileName(fileName)
    if (!token) continue

    const dateValue = dayjs(token, 'MM-DD-YYYY', true).valueOf()
    const filePath = path.resolve(directoryPath, fileName)
    const stats = fs.statSync(filePath)
    candidates.push({
      fileName,
      filePath,
      dateToken: token,
      dateValue,
      mtimeMs: stats.mtimeMs,
    })
  }

  return candidates
}

export function findLatestDatedFile(
  directoryPath: string,
  allowedExtensions: string[],
  fileNamePrefix?: string,
): LatestFileSelection | null {
  const candidates = listDatedCandidates(directoryPath, allowedExtensions, {
    fileNamePrefix,
  })
  if (candidates.length === 0) return null

  let selected: {
    filePath: string
    dateToken: string
    dateValue: number
    mtimeMs: number
  } | null = null

  for (const candidate of candidates) {
    if (!selected) {
      selected = {
        filePath: candidate.filePath,
        dateToken: candidate.dateToken,
        dateValue: candidate.dateValue,
        mtimeMs: candidate.mtimeMs,
      }
      continue
    }

    if (candidate.dateValue > selected.dateValue) {
      selected = {
        filePath: candidate.filePath,
        dateToken: candidate.dateToken,
        dateValue: candidate.dateValue,
        mtimeMs: candidate.mtimeMs,
      }
      continue
    }

    if (
      candidate.dateValue === selected.dateValue &&
      candidate.mtimeMs > selected.mtimeMs
    ) {
      selected = {
        filePath: candidate.filePath,
        dateToken: candidate.dateToken,
        dateValue: candidate.dateValue,
        mtimeMs: candidate.mtimeMs,
      }
    }
  }

  if (!selected) return null
  return { filePath: selected.filePath, dateToken: selected.dateToken }
}

export function findLatestDatedFiles(
  directoryPath: string,
  allowedExtensions: string[],
  options?: FileMatchOptions,
): LatestFilesSelection | null {
  const candidates = listDatedCandidates(directoryPath, allowedExtensions, options)
  if (candidates.length === 0) return null

  let latestDateValue = -Infinity
  for (const candidate of candidates) {
    if (candidate.dateValue > latestDateValue) {
      latestDateValue = candidate.dateValue
    }
  }

  const latestCandidates = candidates
    .filter((candidate) => candidate.dateValue === latestDateValue)
    .sort((a, b) => a.fileName.localeCompare(b.fileName))

  if (latestCandidates.length === 0) return null

  return {
    dateToken: latestCandidates[0].dateToken,
    filePaths: latestCandidates.map((candidate) => candidate.filePath),
  }
}

export async function confirmStep(
  prompt: string,
  autoConfirm: boolean,
): Promise<void> {
  if (autoConfirm) {
    console.log(`${prompt}\nAuto-confirmed (--yes).\n`)
    return
  }

  const rl = readline.createInterface({ input, output })
  const answer = await rl.question(`${prompt}\nContinue? (y/N): `)
  rl.close()
  const normalized = answer.trim().toLowerCase()
  if (normalized !== 'y' && normalized !== 'yes') {
    throw new Error('Pipeline cancelled by user.')
  }
}

export async function runTsxScript(args: string[]): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn('pnpm', ['exec', 'tsx', ...args], {
      cwd: process.cwd(),
      stdio: 'inherit',
      env: process.env,
    })

    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) {
        resolve()
        return
      }
      reject(new Error(`Command failed: pnpm exec tsx ${args.join(' ')}`))
    })
  })
}
