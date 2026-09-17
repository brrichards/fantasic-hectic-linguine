const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const COMPACT = /^[A-Za-z0-9_-]{22}$/

export function isUuid(value: string): boolean {
  return UUID.test(value)
}

export function isCompactId(value: string): boolean {
  return COMPACT.test(value)
}

/** A book id as people share it: the compact form of a container UUID. */
export function shareableId(bookId: string): string {
  return isUuid(bookId) ? compactFromUuid(bookId) : bookId
}

/** Reads a book id out of a pasted compact id, UUID, or raw id. */
export function bookIdFromInput(input: string): string | undefined {
  const text = input.trim()
  if (!text) return undefined
  return isCompactId(text) ? uuidFromCompact(text) : text
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
