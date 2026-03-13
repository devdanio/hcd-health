import path from 'node:path'

export type ClientConfig = {
  GHL_LOCATION_ID: string
  GHL_API_KEY_ENV: string
  HCD_ORG_ID: string
  EHR_SYSTEM: string
  GHL_RAW_DIR: string
  EHR_RAW_DIR: string
  EHR_NORMALIZED_DIR: string
}

export const clients: Record<string, ClientConfig> = {
  thrive: {
    GHL_LOCATION_ID: 'wJVrTbSAivxHv8BabSZZ',
    GHL_API_KEY_ENV: 'GHL_THRIVE_API_KEY',
    HCD_ORG_ID: 'org_39EAg0JNcyIHHgGuJxZVShQNgn0',
    EHR_SYSTEM: 'chirotouch',
    GHL_RAW_DIR: path.resolve(
      process.cwd(),
      'pipeline/client-data/thrive/raw/ghl',
    ),
    EHR_RAW_DIR: path.resolve(
      process.cwd(),
      'pipeline/client-data/thrive/raw/chirotouch',
    ),
    EHR_NORMALIZED_DIR: path.resolve(
      process.cwd(),
      'pipeline/client-data/thrive/normalized/chirotouch',
    ),
  },
  paom: {
    GHL_LOCATION_ID: 'rPIupIkhRChADmZXmldT',
    GHL_API_KEY_ENV: 'GHL_PAOM_API_KEY',
    HCD_ORG_ID: 'org_39GqjHuWMvwSomSqFUnBHhMV2e3',
    EHR_SYSTEM: 'unifiedpractice',
    GHL_RAW_DIR: path.resolve(
      process.cwd(),
      'pipeline/client-data/paom/raw/ghl',
    ),
    EHR_RAW_DIR: path.resolve(
      process.cwd(),
      'pipeline/client-data/paom/raw/unifiedpractice',
    ),
    EHR_NORMALIZED_DIR: path.resolve(
      process.cwd(),
      'pipeline/client-data/paom/normalized/unifiedpractice',
    ),
  },
  ehi: {
    GHL_LOCATION_ID: 'hRKablZc2NUdNQhD5qmy',
    GHL_API_KEY_ENV: 'GHL_EHI_API_KEY',
    HCD_ORG_ID: 'org_39aKhUG0mOgEfNl9crwzA1twB9B',
    EHR_SYSTEM: 'jasmine',
    GHL_RAW_DIR: path.resolve(
      process.cwd(),
      'pipeline/client-data/ehi/raw/ghl',
    ),
    EHR_RAW_DIR: path.resolve(
      process.cwd(),
      'pipeline/client-data/ehi/raw/jasmine',
    ),
    EHR_NORMALIZED_DIR: path.resolve(
      process.cwd(),
      'pipeline/client-data/ehi/normalized/jasmine',
    ),
  },
}

function assertConfigValue(clientName: string, key: keyof ClientConfig): void {
  const value = clients[clientName]?.[key]
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(
      `Missing required client-config value "${key}" for client "${clientName}" in client-config.ts`,
    )
  }
}

export function getClientConfigOrThrow(clientName: string): ClientConfig {
  const client = clients[clientName]
  if (!client) {
    throw new Error(
      `Client "${clientName}" not found in client-config.ts. Available: ${Object.keys(clients).join(', ')}`,
    )
  }

  assertConfigValue(clientName, 'GHL_LOCATION_ID')
  assertConfigValue(clientName, 'GHL_API_KEY_ENV')
  assertConfigValue(clientName, 'HCD_ORG_ID')
  assertConfigValue(clientName, 'EHR_SYSTEM')
  assertConfigValue(clientName, 'GHL_RAW_DIR')
  assertConfigValue(clientName, 'EHR_RAW_DIR')
  assertConfigValue(clientName, 'EHR_NORMALIZED_DIR')

  return client
}
