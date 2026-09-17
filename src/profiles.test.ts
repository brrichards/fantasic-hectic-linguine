import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  addProfile,
  clearActiveBookId,
  forgetProfile,
  getActiveBookId,
  getKnownProfiles,
  profileForBook,
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

  it('updates the name of a book that is already known, keeping its place', () => {
    addProfile({ name: 'Alice', bookId: 'book-a' })
    addProfile({ name: 'Bob', bookId: 'book-b' })
    addProfile({ name: 'Alicia', bookId: 'book-a' })
    expect(getKnownProfiles()).toEqual([
      { name: 'Alicia', bookId: 'book-a' },
      { name: 'Bob', bookId: 'book-b' },
    ])
  })

  it('forgets one book and keeps the others', () => {
    addProfile({ name: 'Alice', bookId: 'book-a' })
    addProfile({ name: 'Bob', bookId: 'book-b' })
    forgetProfile('book-a')
    expect(getKnownProfiles()).toEqual([{ name: 'Bob', bookId: 'book-b' }])
    forgetProfile('never-known')
    expect(getKnownProfiles()).toHaveLength(1)
  })

  it('has no active book in a tab that has not signed in, whatever books are known', () => {
    addProfile({ name: 'Alice', bookId: 'book-a' })
    expect(getActiveBookId()).toBeUndefined()
  })

  it('signs this tab in, and only this tab', () => {
    addProfile({ name: 'Alice', bookId: 'book-a' })
    setActiveBookId('book-a')
    expect(getActiveBookId()).toBe('book-a')
    sessionStorage.clear() // a fresh tab has no choice of its own
    expect(getActiveBookId()).toBeUndefined()
  })

  it('signs in to a book this browser has never seen', () => {
    setActiveBookId('book-new')
    expect(getActiveBookId()).toBe('book-new')
  })

  it('signs this tab out', () => {
    setActiveBookId('book-a')
    clearActiveBookId()
    expect(getActiveBookId()).toBeUndefined()
  })

  it('survives storage being unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(getKnownProfiles()).toEqual([])
    expect(() => addProfile({ name: 'Alice', bookId: 'book-a' })).not.toThrow()
    expect(() => setActiveBookId('book-a')).not.toThrow()
    expect(() => clearActiveBookId()).not.toThrow()
    expect(() => forgetProfile('book-a')).not.toThrow()
    expect(getActiveBookId()).toBeUndefined()
  })
})
