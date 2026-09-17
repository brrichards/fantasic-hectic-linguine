import { describe, expect, it } from 'vitest'
import { bookIdFromInput, compactFromUuid, shareableId, uuidFromCompact } from './ids'

const uuid = '7a113933-fa9b-4f61-a04d-82d1807a191a'

describe('book ids as people type and share them', () => {
  it('reads a pasted compact id as the UUID it stands for', () => {
    expect(bookIdFromInput(compactFromUuid(uuid))).toBe(uuid)
  })

  it('passes a UUID or any other id through, without surrounding whitespace', () => {
    expect(bookIdFromInput(`  ${uuid}\n`)).toBe(uuid)
    expect(bookIdFromInput(' book-1 ')).toBe('book-1')
  })

  it('reads nothing from blank input', () => {
    expect(bookIdFromInput('')).toBeUndefined()
    expect(bookIdFromInput('   ')).toBeUndefined()
  })

  it('shares a UUID in its compact form and any other id as it is', () => {
    expect(shareableId(uuid)).toBe(compactFromUuid(uuid))
    expect(shareableId('book-1')).toBe('book-1')
  })
})

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
