/**
 * Token encryption utilities using AES-GCM
 * Provides secure encryption/decryption for OAuth tokens stored in database
 */

/**
 * Convert ArrayBuffer to base64 string
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

/**
 * Convert base64 string to ArrayBuffer
 */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}

/**
 * Get encryption key from environment variable
 * Key should be a 32-byte (256-bit) base64-encoded string
 */
async function getEncryptionKey(): Promise<CryptoKey> {
  const keyMaterial = process.env.GOOGLE_ADS_ENCRYPTION_KEY

  if (!keyMaterial) {
    throw new Error(
      'Missing GOOGLE_ADS_ENCRYPTION_KEY environment variable. ' +
      'Generate one with: openssl rand -base64 32'
    )
  }

  // Decode base64 key material
  const keyData = base64ToArrayBuffer(keyMaterial)

  // Import as AES-GCM key
  return await crypto.subtle.importKey(
    'raw',
    keyData,
    'AES-GCM',
    false,
    ['encrypt', 'decrypt']
  )
}

/**
 * Encrypt a token using AES-GCM
 * Returns: base64(iv):base64(encrypted_data)
 */
export async function encryptToken(token: string): Promise<string> {
  const key = await getEncryptionKey()

  // Generate random 12-byte IV (initialization vector)
  const iv = crypto.getRandomValues(new Uint8Array(12))

  // Encode token as UTF-8
  const encoded = new TextEncoder().encode(token)

  // Encrypt with AES-GCM
  const encrypted = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv,
    },
    key,
    encoded
  )

  // Return as base64(iv):base64(encrypted_data)
  return arrayBufferToBase64(iv.buffer) + ':' + arrayBufferToBase64(encrypted)
}

/**
 * Decrypt a token using AES-GCM
 * Input format: base64(iv):base64(encrypted_data)
 */
export async function decryptToken(encryptedToken: string): Promise<string> {
  const key = await getEncryptionKey()

  // Split IV and encrypted data
  const parts = encryptedToken.split(':')
  if (parts.length !== 2) {
    throw new Error('Invalid encrypted token format')
  }

  const [ivB64, dataB64] = parts
  const iv = base64ToArrayBuffer(ivB64)
  const data = base64ToArrayBuffer(dataB64)

  // Decrypt with AES-GCM
  try {
    const decrypted = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv,
      },
      key,
      data
    )

    // Decode UTF-8
    return new TextDecoder().decode(decrypted)
  } catch (error) {
    throw new Error('Failed to decrypt token. The encryption key may be incorrect.')
  }
}
