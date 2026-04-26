// AES-256-GCM helpers for the SnapTrade userSecret stored on the User model.
//
// Adapted from the Node.js crypto docs example for createCipheriv:
//   https://nodejs.org/api/crypto.html#class-cipher
//   https://nodejs.org/api/crypto.html#cryptocreatecipherivalgorithm-key-iv-options
//
// Storage format is "ivHex:authTagHex:ciphertextHex" so the IV and the auth tag
// travel with the ciphertext (each value gets its own random IV).
//
// USER_SECRET_ENCRYPTION_KEY must be a 64-character hex string (32 bytes).
// Generate one with: openssl rand -hex 32
//
// In development the helpers fall back to plaintext if the key is missing so
// `npm run dev` works without configuration. In production a missing key throws.

import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'

function getKey() {
  return process.env.USER_SECRET_ENCRYPTION_KEY
}

export function encrypt(text) {
  if (!text) return text

  const key = getKey()
  if (!key) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('USER_SECRET_ENCRYPTION_KEY is not set. Refusing to save userSecret as plaintext.')
    }
    console.warn('USER_SECRET_ENCRYPTION_KEY not set — userSecret stored as plaintext (dev only)')
    return text
  }

  const keyBuf = Buffer.from(key, 'hex')
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(ALGORITHM, keyBuf, iv)
  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  const authTag = cipher.getAuthTag().toString('hex')
  return `${iv.toString('hex')}:${authTag}:${encrypted}`
}

export function decrypt(text) {
  if (!text) return text

  const key = getKey()
  if (!key) return text
  if (!text.includes(':')) return text

  try {
    const keyBuf = Buffer.from(key, 'hex')
    const [ivHex, authTagHex, ciphertext] = text.split(':')
    const iv = Buffer.from(ivHex, 'hex')
    const authTag = Buffer.from(authTagHex, 'hex')
    const decipher = crypto.createDecipheriv(ALGORITHM, keyBuf, iv)
    decipher.setAuthTag(authTag)
    let decrypted = decipher.update(ciphertext, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    return decrypted
  } catch (err) {
    console.error('userSecret decryption failed:', err?.message || err)
    return null
  }
}
