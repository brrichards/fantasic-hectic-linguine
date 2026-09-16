import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  addProfile,
  ensureDummyProfiles,
  getActiveBookId,
  getKnownProfiles,
  profileForBook,
  resetProfiles,
  setActiveBookId,
} from './profiles'

describe('profiles', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })
  afterEach(() => vi.restoreAllMocks())

  it('remembers added profiles in order and finds them by book', () => {
    addProfile({ name: 'Alice', bookId: 'book-a' })
    addProfile({ name: 'Bob', bookId: 'book-b' })
    expect(getKnownProfiles()).toEqual([
      { name: 'Alice', bookId: 'book-a' },
      { name: 'Bob', bookId: 'book-b' },
    ])
    expect(profileForBook('book-b')).toEqual({ name: 'Bob', bookId: 'book-b' })
    expect(profileForBook('nope')).toBeUndefined()
  })

  it('does not add the same book twice', () => {
    addProfile({ name: 'Alice', bookId: 'book-a' })
    addProfile({ name: 'Alice again', bookId: 'book-a' })
    expect(getKnownProfiles()).toHaveLength(1)
  })

  it('defaults the active profile to the first known one', () => {
    addProfile({ name: 'Alice', bookId: 'book-a' })
    addProfile({ name: 'Bob', bookId: 'book-b' })
    expect(getActiveBookId()).toBe('book-a')
  })

  it('switches the active profile for this tab and remembers it for the browser', () => {
    addProfile({ name: 'Alice', bookId: 'book-a' })
    addProfile({ name: 'Bob', bookId: 'book-b' })
    setActiveBookId('book-b')
    expect(getActiveBookId()).toBe('book-b')
    expect(sessionStorage.getItem('fhl.recipes.activeBook')).toBe('book-b')
    expect(localStorage.getItem('fhl.recipes.lastBook')).toBe('book-b')
  })

  it('opens a new tab as whoever was chosen last anywhere in the browser', () => {
    addProfile({ name: 'Alice', bookId: 'book-a' })
    addProfile({ name: 'Bob', bookId: 'book-b' })
    setActiveBookId('book-b')
    sessionStorage.clear() // a fresh tab has no choice of its own
    expect(getActiveBookId()).toBe('book-b')
  })

  it("keeps a tab's own choice when another tab chooses differently", () => {
    addProfile({ name: 'Alice', bookId: 'book-a' })
    addProfile({ name: 'Bob', bookId: 'book-b' })
    setActiveBookId('book-b')
    localStorage.setItem('fhl.recipes.lastBook', 'book-a') // another tab picked Alice
    expect(getActiveBookId()).toBe('book-b')
  })

  it('ignores a remembered profile that is no longer known', () => {
    addProfile({ name: 'Alice', bookId: 'book-a' })
    localStorage.setItem('fhl.recipes.lastBook', 'gone')
    expect(getActiveBookId()).toBe('book-a')
    setActiveBookId('gone')
    expect(getActiveBookId()).toBe('book-a')
  })

  it('creates Alice and Bob once, through the given book factory', async () => {
    let n = 0
    const createBook = async () => `book-${++n}`
    expect(await ensureDummyProfiles(createBook)).toEqual([
      { name: 'Alice', bookId: 'book-1' },
      { name: 'Bob', bookId: 'book-2' },
    ])
    expect(await ensureDummyProfiles(createBook)).toHaveLength(2)
    expect(n).toBe(2)
  })

  it('resetProfiles forgets every profile and the active choice', () => {
    addProfile({ name: 'Alice', bookId: 'book-a' })
    setActiveBookId('book-a')
    resetProfiles()
    expect(getKnownProfiles()).toEqual([])
    expect(getActiveBookId()).toBeUndefined()
    expect(localStorage.getItem('fhl.recipes.lastBook')).toBeNull()
  })

  it('survives storage being unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(getKnownProfiles()).toEqual([])
    expect(() => addProfile({ name: 'Alice', bookId: 'book-a' })).not.toThrow()
    expect(() => setActiveBookId('book-a')).not.toThrow()
  })
})
