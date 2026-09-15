import { describe, expect, it } from 'vitest'
import { compactFromUuid, isUuid, shortId, uuidFromCompact } from './ids'

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

  it('round-trips the all-zero and all-f UUIDs', () => {
    for (const edge of ['00000000-0000-0000-0000-000000000000', 'ffffffff-ffff-ffff-ffff-ffffffffffff']) {
      expect(uuidFromCompact(compactFromUuid(edge))).toBe(edge)
    }
  })

  it('rejects input that is not a UUID or not a compact id', () => {
    expect(() => compactFromUuid('not-a-uuid')).toThrow()
    expect(() => uuidFromCompact('too-short')).toThrow()
    expect(() => uuidFromCompact('!'.repeat(22))).toThrow()
  })

  it('recognises UUIDs', () => {
    expect(isUuid(uuid)).toBe(true)
    expect(isUuid('home-book')).toBe(false)
  })
})

describe('shortId', () => {
  it('is 8 base62 characters', () => {
    expect(shortId()).toMatch(/^[A-Za-z0-9]{8}$/)
  })

  it('does not repeat', () => {
    const ids = new Set(Array.from({ length: 500 }, () => shortId()))
    expect(ids.size).toBe(500)
  })
})
