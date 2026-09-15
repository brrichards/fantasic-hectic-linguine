const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const COMPACT = /^[A-Za-z0-9_-]{22}$/
const BASE62 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

export function isUuid(value: string): boolean {
  return UUID.test(value)
}

export function isCompactId(value: string): boolean {
  return COMPACT.test(value)
}

/** The 16 bytes of a UUID as 22 url-safe base64 characters, no padding. */
export function compactFromUuid(uuid: string): string {
  if (!isUuid(uuid)) throw new Error(`Not a UUID: ${uuid}`)
  const hex = uuid.replace(/-/g, '')
  const bytes = Uint8Array.from({ length: 16 }, (_, i) => parseInt(hex.slice(i * 2, i * 2 + 2), 16))
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

/** Inverse of {@link compactFromUuid}; the result is lowercase. */
export function uuidFromCompact(compact: string): string {
  if (!isCompactId(compact)) throw new Error(`Not a compact id: ${compact}`)
  const base64 = compact.replace(/-/g, '+').replace(/_/g, '/') + '=='
  const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))
  if (bytes.length !== 16) throw new Error(`Not a compact id: ${compact}`)
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

/** Eight random base62 characters: 47 bits, plenty for ids within one book. */
export function shortId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8))
  return [...bytes].map((byte) => BASE62[byte % BASE62.length]).join('')
}
