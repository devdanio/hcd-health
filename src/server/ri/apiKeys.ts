import crypto from 'node:crypto'

const API_KEY_PREFIX = 'hri_live_'

export function generateApiKey(): { apiKey: string; keyPrefix: string } {
  const random = crypto.randomBytes(32).toString('base64url')
  const apiKey = `${API_KEY_PREFIX}${random}`
  const keyPrefix = apiKey.slice(0, API_KEY_PREFIX.length + 8)
  return { apiKey, keyPrefix }
}

export function hashApiKey(apiKey: string): string {
  return crypto.createHash('sha256').update(apiKey).digest('hex')
}

export function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader) return null
  const trimmed = authHeader.trim()
  const match = /^Bearer\s+(.+)$/i.exec(trimmed)
  return match?.[1]?.trim() || null
}

export async function getOrganizationIdForApiKey(apiKey: string): Promise<{
  organizationId: string
  apiKeyId: string
}> {
  const { prisma } = await import('@/db')
  const keyHash = hashApiKey(apiKey)

  const found = await prisma.organization_api_keys.findUnique({
    where: { key_hash: keyHash },
    select: { id: true, organization_id: true, revoked_at: true },
  })

  if (!found || found.revoked_at) {
    throw new Error('Invalid API key')
  }

  await prisma.organization_api_keys.update({
    where: { id: found.id },
    data: { last_used_at: new Date() },
  })

  return { organizationId: found.organization_id, apiKeyId: found.id }
}
