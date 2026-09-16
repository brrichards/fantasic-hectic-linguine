import { describe, expect, it } from 'vitest'
import { compactFromUuid, uuidFromCompact } from './ids'

const uuid = '7a113933-fa9b-4f61-a04d-82d1807a191a'

describe('compact book ids', () => {
  it('encodes a UUID as 22 url-safe characters and decodes it back', () => {
    const compact = compactFromUuid(uuid)
    expect(compact).toHaveLength(22)
    expect(compact).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(uuidFromCompact(compact)).toBe(uuid)
  })

  it('accepts uppercase UUIDs and always decodes to lowercase', () => {
    expect(uuidFromCompact(compactFromUuid(uuid.toUpperCase()))).toBe(uuid)
  })

  it('rejects input that is not a UUID or not a compact id', () => {
    expect(() => compactFromUuid('not-a-uuid')).toThrow()
    expect(() => uuidFromCompact('too-short')).toThrow()
    expect(() => uuidFromCompact('!'.repeat(22))).toThrow()
  })
})
