import type { TreeView } from 'fluid-framework'
import type { RecipeBook } from '../fluid/schema'
import type { Connect } from '../fluid/session'
import { fakeContainerSource, makeBookView } from './fakeContainerSource'

/**
 * An in-memory Fluid service for tests: books live in a map, and every call
 * that would reach the service is logged.
 */
export function fakeFluid() {
  const books = new Map<string, TreeView<typeof RecipeBook>>()
  const log: string[] = []
  const recipes = fakeContainerSource()

  /** Puts a book on the service, as if it had been created some other time. */
  const addBook = (name: string): string => {
    const bookId = `book-${books.size + 1}`
    books.set(bookId, makeBookView(name))
    return bookId
  }

  const connect: Connect = async (userName) => {
    log.push(`connect ${userName}`)
    return {
      source: recipes.source,
      async createBook(name) {
        const bookId = addBook(name)
        log.push(`create ${bookId}`)
        return { view: books.get(bookId)!, bookId }
      },
      async openBook(bookId) {
        log.push(`open ${bookId}`)
        const view = books.get(bookId)
        if (!view) throw new Error(`no book ${bookId}`)
        return { view, bookId }
      },
    }
  }

  return { connect, log, books, addBook }
}
