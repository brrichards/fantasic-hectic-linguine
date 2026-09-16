import { fireEvent, render, screen, within } from '@testing-library/react'
import { act } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { RecipeCard } from './fluid/schema'
import { RecipeSession } from './fluid/session'
import { compactFromUuid } from './ids'
import { addProfile, getActiveBookId, setActiveBookId } from './profiles'
import { getSelectedRecipeId, getVisitingBookId, setSelectedRecipeId } from './tabState'
import { fakeContainerSource, makeBookView } from './test/fakeContainerSource'

const HOME = 'home-book'
const THEIRS = 'their-book'

function setup({ browsing = false } = {}) {
  localStorage.clear()
  sessionStorage.clear()
  addProfile({ name: 'Alice', bookId: HOME })
  addProfile({ name: 'Bob', bookId: THEIRS })
  setActiveBookId(HOME)
  const home = makeBookView()
  const theirs = makeBookView()
  const fake = fakeContainerSource()
  const session = new RecipeSession(
    {
      home: { view: home, bookId: HOME },
      ...(browsing ? { browsed: { view: theirs, bookId: THEIRS } } : {}),
    },
    fake.source,
  )
  const reload = vi.fn()
  return { session, reload, home: home.root, theirs: theirs.root, ...fake }
}

function stubClipboard() {
  const writeText = vi.fn(() => Promise.resolve())
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
  return writeText
}

/** Creates a recipe through the session, then deselects so tests start from the list. */
async function seed(session: RecipeSession, title: string) {
  const card = await session.createRecipe(title)
  session.deselect()
  return card
}

const detailPanel = () => screen.findByRole('article')

afterEach(() => {
  Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true })
})

describe('App on the home book', () => {
  it('prompts to pick a recipe when none is selected', () => {
    const { session, reload } = setup()
    render(<App session={session} reload={reload} />)
    expect(screen.getByText(/select a recipe/i)).toBeInTheDocument()
    expect(screen.queryByText(/viewing/i)).toBeNull()
  })

  it('shows who you are and reloads as the other profile when switched', () => {
    const { session, reload } = setup()
    render(<App session={session} reload={reload} />)
    const picker = screen.getByRole('combobox', { name: /you are/i })
    expect(picker).toHaveValue(HOME)
    expect([...picker.querySelectorAll('option')].map((o) => o.textContent)).toEqual(['Alice', 'Bob'])
    fireEvent.change(picker, { target: { value: THEIRS } })
    expect(getActiveBookId()).toBe(THEIRS)
    expect(getVisitingBookId()).toBeUndefined()
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('shows the book id for sharing and copies it', () => {
    const writeText = stubClipboard()
    const { session, reload } = setup()
    render(<App session={session} reload={reload} />)
    expect(screen.getByRole('textbox', { name: 'Book id' })).toHaveValue(HOME)
    fireEvent.click(screen.getByRole('button', { name: 'Copy book id' }))
    expect(writeText).toHaveBeenCalledWith(HOME)
  })

  it('visits a book from a pasted id', () => {
    const { session, reload } = setup()
    render(<App session={session} reload={reload} />)
    fireEvent.change(screen.getByRole('textbox', { name: /book id to visit/i }), {
      target: { value: '  their-book ' },
    })
    fireEvent.click(screen.getByRole('button', { name: /visit/i }))
    expect(getVisitingBookId()).toBe(THEIRS)
    expect(getActiveBookId()).toBe(HOME)
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('accepts a compact book id when visiting', () => {
    const uuid = '7a113933-fa9b-4f61-a04d-82d1807a191a'
    const { session, reload } = setup()
    render(<App session={session} reload={reload} />)
    fireEvent.change(screen.getByRole('textbox', { name: /book id to visit/i }), {
      target: { value: compactFromUuid(uuid) },
    })
    fireEvent.click(screen.getByRole('button', { name: /visit/i }))
    expect(getVisitingBookId()).toBe(uuid)
  })

  it('does not visit on a blank id or your own book', () => {
    const { session, reload } = setup()
    render(<App session={session} reload={reload} />)
    fireEvent.click(screen.getByRole('button', { name: /visit/i }))
    fireEvent.change(screen.getByRole('textbox', { name: /book id to visit/i }), {
      target: { value: HOME },
    })
    fireEvent.click(screen.getByRole('button', { name: /visit/i }))
    expect(getVisitingBookId()).toBeUndefined()
    expect(reload).not.toHaveBeenCalled()
  })

  it('opens a recipe when its title is clicked and remembers it for this tab', async () => {
    const { session, reload } = setup()
    const soup = await seed(session, 'Soup')
    render(<App session={session} reload={reload} />)
    fireEvent.click(screen.getByRole('button', { name: 'Soup' }))
    expect(await detailPanel()).toBeInTheDocument()
    expect(getSelectedRecipeId()).toBe(soup.id)
  })

  it('opens a recipe as soon as it is created', async () => {
    const { session, reload, home } = setup()
    render(<App session={session} reload={reload} />)
    fireEvent.change(screen.getByRole('textbox', { name: /new recipe/i }), {
      target: { value: 'Bread' },
    })
    fireEvent.click(screen.getByRole('button', { name: /add recipe/i }))
    expect(await detailPanel()).toBeInTheDocument()
    expect(home.cards.length).toBe(1)
    expect(home.cards[0].title).toBe('Bread')
    expect(getSelectedRecipeId()).toBe(home.cards[0].id)
  })

  it('opens a newly created recipe in edit mode', async () => {
    const { session, reload } = setup()
    render(<App session={session} reload={reload} />)
    fireEvent.change(screen.getByRole('textbox', { name: /new recipe/i }), {
      target: { value: 'Bread' },
    })
    fireEvent.click(screen.getByRole('button', { name: /add recipe/i }))
    const detail = await detailPanel()
    expect(within(detail).getByRole('button', { name: 'Edit', pressed: true })).toBeInTheDocument()
    expect(detail.querySelectorAll('.ql-editor').length).toBeGreaterThan(0)
  })

  it('opens an existing recipe in view mode', async () => {
    const { session, reload } = setup()
    await seed(session, 'Soup')
    render(<App session={session} reload={reload} />)
    fireEvent.click(screen.getByRole('button', { name: 'Soup' }))
    const detail = await detailPanel()
    expect(within(detail).getByRole('button', { name: 'View', pressed: true })).toBeInTheDocument()
    expect(detail.querySelector('.ql-editor')).toBeNull()
    expect(within(detail).getByRole('heading', { level: 2, name: 'Soup' })).toBeInTheDocument()
  })

  it('shows the sharing checkbox on your own recipe', async () => {
    const { session, reload } = setup()
    await seed(session, 'Soup')
    render(<App session={session} reload={reload} />)
    fireEvent.click(screen.getByRole('button', { name: 'Soup' }))
    const detail = await detailPanel()
    expect(within(detail).getByRole('checkbox', { name: /allow others to edit/i })).toBeChecked()
    expect(within(detail).getByRole('button', { name: 'Edit' })).toBeEnabled()
  })

  it('reopens the recipe this tab had open', async () => {
    const { session, reload } = setup()
    const soup = await seed(session, 'Soup')
    setSelectedRecipeId(soup.id)
    render(<App session={session} reload={reload} />)
    expect(await detailPanel()).toBeInTheDocument()
  })

  it('forgets a remembered recipe that no longer exists', async () => {
    const { session, reload } = setup()
    setSelectedRecipeId('gone')
    render(<App session={session} reload={reload} />)
    await act(async () => {}) // reopening starts after the first render
    expect(screen.getByText(/select a recipe/i)).toBeInTheDocument()
    expect(getSelectedRecipeId()).toBeUndefined()
  })

  it('returns to the prompt when the open recipe is removed by another client', async () => {
    const { session, reload, home } = setup()
    await seed(session, 'Soup')
    render(<App session={session} reload={reload} />)
    fireEvent.click(screen.getByRole('button', { name: 'Soup' }))
    await detailPanel()
    act(() => {
      home.cards.removeAt(0)
    })
    expect(await screen.findByText(/select a recipe/i)).toBeInTheDocument()
    expect(session.current).toBeUndefined()
    expect(getSelectedRecipeId()).toBeUndefined()
  })

  it('shows an error and keeps the list when a recipe container cannot be opened', async () => {
    const { session, reload, home } = setup()
    await seed(session, 'Soup')
    home.cards.add(
      new RecipeCard({
        id: 'container-missing',
        title: 'Ghost',
        tags: {},
        authorId: HOME,
      }),
    )
    render(<App session={session} reload={reload} />)
    fireEvent.click(screen.getByRole('button', { name: 'Ghost' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not open/i)
    expect(screen.getByRole('button', { name: 'Soup' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ghost' })).toBeInTheDocument()
  })
})

describe('App visiting another book', () => {
  it('shows whose book it is and goes home on request', () => {
    const { session, reload } = setup({ browsing: true })
    sessionStorage.setItem('fhl.recipes.visitingBook', THEIRS)
    render(<App session={session} reload={reload} />)
    expect(screen.getByText(/viewing Bob's book/i)).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Book id' })).toHaveValue(THEIRS)
    fireEvent.click(screen.getByRole('button', { name: /back to my book/i }))
    expect(getVisitingBookId()).toBeUndefined()
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('lists their cards and creates new recipes in their book', async () => {
    const { session, reload, theirs, home } = setup({ browsing: true })
    await seed(session, 'Soup')
    render(<App session={session} reload={reload} />)
    expect(screen.getByRole('button', { name: 'Soup' })).toBeInTheDocument()
    fireEvent.change(screen.getByRole('textbox', { name: /new recipe/i }), {
      target: { value: 'Bread' },
    })
    fireEvent.click(screen.getByRole('button', { name: /add recipe/i }))
    await detailPanel()
    expect(theirs.cards.map((c) => c.title)).toEqual(['Soup', 'Bread'])
    expect(home.cards.length).toBe(0)
  })

  it('locks their recipe to view mode when they do not allow editing', async () => {
    const { session, reload } = setup({ browsing: true })
    await session.createRecipe('Soup')
    session.current!.recipe.othersMayEdit = false
    session.deselect()
    render(<App session={session} reload={reload} />)
    fireEvent.click(screen.getByRole('button', { name: 'Soup' }))
    const detail = await detailPanel()
    expect(within(detail).queryByRole('checkbox')).toBeNull()
    expect(within(detail).getByRole('button', { name: 'Edit' })).toBeDisabled()
    expect(within(detail).getByRole('button', { name: /save to my book/i })).toBeInTheDocument()
  })

  it('saves a card into the home book from the list', async () => {
    const { session, reload, home } = setup({ browsing: true })
    const soup = await seed(session, 'Soup')
    render(<App session={session} reload={reload} />)
    const row = screen.getAllByRole('listitem')[0]
    fireEvent.click(within(row).getByRole('button', { name: /save to my book/i }))
    expect(home.cards.findById(soup.id)).toBeDefined()
    expect(within(row).getByRole('button', { name: /saved/i })).toBeDisabled()
  })

  it('saves the open recipe from the detail view', async () => {
    const { session, reload, home } = setup({ browsing: true })
    const soup = await seed(session, 'Soup')
    render(<App session={session} reload={reload} />)
    fireEvent.click(screen.getByRole('button', { name: 'Soup' }))
    await detailPanel()
    const detail = screen.getByRole('article')
    fireEvent.click(within(detail).getByRole('button', { name: /save to my book/i }))
    expect(home.cards.findById(soup.id)).toBeDefined()
    expect(within(detail).getByRole('button', { name: /saved/i })).toBeDisabled()
  })

  it('visits the book a saved card came from', async () => {
    const { session, reload, home } = setup()
    home.cards.add(
      new RecipeCard({
        id: 'container-x',
        title: 'Soup',
        tags: {},
        authorId: THEIRS,
      }),
    )
    render(<App session={session} reload={reload} />)
    fireEvent.click(screen.getByRole('button', { name: "from Bob's book" }))
    expect(getVisitingBookId()).toBe(THEIRS)
    expect(reload).toHaveBeenCalledTimes(1)
  })
})
