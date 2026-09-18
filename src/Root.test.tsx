import { fireEvent, render, screen } from '@testing-library/react'
import { StrictMode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Root } from './Root'
import type { Connect } from './fluid/session'
import { addProfile, getActiveBookId, getKnownProfiles, setActiveBookId } from './profiles'
import { getVisitingBookId, setVisitingBookId } from './tabState'
import { fakeFluid } from './test/fakeFluid'

/** The app proper, as opposed to the start page, is on screen. */
const theApp = () => screen.findByText(/^Select a recipe/)
const startPage = () => screen.queryByRole('heading', { name: 'Open a book' })

function openById(bookId: string) {
  fireEvent.change(screen.getByLabelText('Book id'), { target: { value: bookId } })
  fireEvent.click(screen.getByRole('button', { name: 'Open' }))
}

function createNamed(name: string) {
  fireEvent.change(screen.getByLabelText('Book name'), { target: { value: name } })
  fireEvent.click(screen.getByRole('button', { name: 'Create' }))
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})
afterEach(() => vi.restoreAllMocks())

describe('Root before sign-in', () => {
  it('shows the start page without reaching the Fluid service', () => {
    const fluid = fakeFluid()
    render(<Root connect={fluid.connect} />)
    expect(startPage()).toBeInTheDocument()
    expect(fluid.log).toEqual([])
  })

  it('creates one named book and signs this tab in to it', async () => {
    const fluid = fakeFluid()
    render(<Root connect={fluid.connect} />)
    createNamed('Carol')
    await theApp()
    expect(screen.getByText(/Carol/)).toBeInTheDocument()
    expect(fluid.log).toEqual(['connect Carol', 'create book-1'])
    expect(fluid.books.get('book-1')!.root.name).toBe('Carol')
    expect(getActiveBookId()).toBe('book-1')
    expect(getKnownProfiles()).toEqual([{ name: 'Carol', bookId: 'book-1' }])
  })

  it('opens an existing book by id in a browser that has never seen it', async () => {
    const fluid = fakeFluid()
    const bookId = fluid.addBook('Dana')
    render(<Root connect={fluid.connect} />)
    openById(bookId)
    await theApp()
    expect(screen.getByText(/Dana/)).toBeInTheDocument()
    expect(fluid.log).toContain(`open ${bookId}`)
    expect(fluid.log.filter((entry) => entry.startsWith('create'))).toEqual([])
    expect(getActiveBookId()).toBe(bookId)
    expect(getKnownProfiles()).toEqual([{ name: 'Dana', bookId }])
  })

  it('opens a remembered book and refreshes its name from the book itself', async () => {
    const fluid = fakeFluid()
    const bookId = fluid.addBook('Dana')
    addProfile({ name: 'An old name', bookId })
    render(<Root connect={fluid.connect} />)
    fireEvent.click(screen.getByRole('button', { name: 'An old name' }))
    await theApp()
    expect(fluid.log[0]).toBe('connect An old name')
    expect(getKnownProfiles()).toEqual([{ name: 'Dana', bookId }])
  })

  it('stays on the start page with an error when the id opens nothing', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const fluid = fakeFluid()
    render(<Root connect={fluid.connect} />)
    openById('no-such-book')
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not be opened/i)
    expect(startPage()).toBeInTheDocument()
    expect(screen.getByLabelText('Book id')).toHaveValue('no-such-book')
    expect(getActiveBookId()).toBeUndefined()
    expect(getKnownProfiles()).toEqual([])
  })

  it('stays on the start page with an error when the service cannot be reached', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const offline: Connect = async () => {
      throw new Error('offline')
    }
    render(<Root connect={offline} />)
    createNamed('Carol')
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not be created/i)
    expect(getActiveBookId()).toBeUndefined()
  })

  it('creates only one book however many times create is pressed', async () => {
    const fluid = fakeFluid()
    let release = () => {}
    const held = new Promise<void>((resolve) => (release = resolve))
    const slow: Connect = async (userName) => {
      await held
      return fluid.connect(userName)
    }
    render(<Root connect={slow} />)
    createNamed('Carol')
    expect(screen.getByRole('button', { name: 'Create' })).toBeDisabled()
    fireEvent.submit(screen.getByLabelText('Book name').closest('form')!)
    release()
    await theApp()
    expect(fluid.log.filter((entry) => entry.startsWith('create'))).toEqual(['create book-1'])
  })

  it('forgets a remembered book on request', () => {
    const fluid = fakeFluid()
    addProfile({ name: 'Alice', bookId: 'book-a' })
    addProfile({ name: 'Bob', bookId: 'book-b' })
    render(<Root connect={fluid.connect} />)
    fireEvent.click(screen.getByRole('button', { name: 'Forget Alice' }))
    expect(screen.queryByRole('button', { name: 'Alice' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Bob' })).toBeInTheDocument()
    expect(getKnownProfiles()).toEqual([{ name: 'Bob', bookId: 'book-b' }])
  })

  it('does not carry a visit left over in this tab into a new sign-in', async () => {
    const fluid = fakeFluid()
    const theirs = fluid.addBook('Bob')
    setVisitingBookId(theirs)
    render(<Root connect={fluid.connect} />)
    createNamed('Carol')
    await theApp()
    expect(getVisitingBookId()).toBeUndefined()
    expect(screen.queryByText(/You are viewing/)).not.toBeInTheDocument()
  })
})

describe('Root in a tab that is already signed in', () => {
  it('goes straight to the book, opening it once even under StrictMode', async () => {
    const fluid = fakeFluid()
    const bookId = fluid.addBook('Dana')
    addProfile({ name: 'Dana', bookId })
    setActiveBookId(bookId)
    render(
      <StrictMode>
        <Root connect={fluid.connect} />
      </StrictMode>,
    )
    expect(startPage()).not.toBeInTheDocument()
    await theApp()
    expect(fluid.log).toEqual(['connect Dana', `open ${bookId}`])
  })

  it('signs the tab out and explains when its book no longer opens', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const fluid = fakeFluid()
    setActiveBookId('gone')
    render(<Root connect={fluid.connect} />)
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not be opened/i)
    expect(startPage()).toBeInTheDocument()
    expect(getActiveBookId()).toBeUndefined()
  })

  it('shows the book this tab is visiting', async () => {
    const fluid = fakeFluid()
    const mine = fluid.addBook('Dana')
    const theirs = fluid.addBook('Bob')
    setActiveBookId(mine)
    setVisitingBookId(theirs)
    render(<Root connect={fluid.connect} />)
    await theApp()
    expect(screen.getByText(/You are viewing/)).toBeInTheDocument()
    expect(getKnownProfiles()).toEqual([{ name: 'Dana', bookId: mine }])
  })

  it('offers the way home when the visited book does not open', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const fluid = fakeFluid()
    const mine = fluid.addBook('Dana')
    setActiveBookId(mine)
    setVisitingBookId('gone')
    const reloadPage = vi.fn()
    render(<Root connect={fluid.connect} reloadPage={reloadPage} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Back to my book' }))
    expect(getVisitingBookId()).toBeUndefined()
    expect(getActiveBookId()).toBe(mine)
    expect(reloadPage).toHaveBeenCalledOnce()
  })
})
