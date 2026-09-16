import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearSelectedRecipeId,
  clearVisitingBookId,
  getSelectedRecipeId,
  getVisitingBookId,
  setSelectedRecipeId,
  setVisitingBookId,
} from './tabState'

describe('tab state', () => {
  beforeEach(() => sessionStorage.clear())
  afterEach(() => vi.restoreAllMocks())

  it('remembers the visited book and the selected recipe for this tab', () => {
    setVisitingBookId('book-b')
    setSelectedRecipeId('r1')
    expect(getVisitingBookId()).toBe('book-b')
    expect(getSelectedRecipeId()).toBe('r1')
    expect(localStorage.getItem('fhl.recipes.visitingBook')).toBeNull()
  })

  it('clears them independently', () => {
    setVisitingBookId('book-b')
    setSelectedRecipeId('r1')
    clearSelectedRecipeId()
    expect(getVisitingBookId()).toBe('book-b')
    expect(getSelectedRecipeId()).toBeUndefined()
    clearVisitingBookId()
    expect(getVisitingBookId()).toBeUndefined()
  })

  it('survives storage being unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(getVisitingBookId()).toBeUndefined()
    expect(() => setVisitingBookId('book-b')).not.toThrow()
    expect(() => setSelectedRecipeId('r1')).not.toThrow()
  })
})
