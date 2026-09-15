import { Tree } from 'fluid-framework'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RecipeCard } from './schema'
import { RecipeSession } from './session'
import { fakeContainerSource, makeBookView } from '../test/fakeContainerSource'

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

/** A session on the user's own book. */
function homeSession() {
  const fake = fakeContainerSource()
  const home = makeBookView()
  const session = new RecipeSession({ home: { view: home, bookId: 'home' } }, fake.source)
  return { session, home, ...fake }
}

/** A session browsing someone else's book, with the user's own book open behind it. */
function browsingSession() {
  const fake = fakeContainerSource()
  const home = makeBookView()
  const theirs = makeBookView()
  const session = new RecipeSession(
    { home: { view: home, bookId: 'home' }, browsed: { view: theirs, bookId: 'theirs' } },
    fake.source,
  )
  return { session, home, theirs, ...fake }
}

describe('RecipeSession on the home book', () => {
  it('createRecipe opens a container, then adds a card pointing at it', async () => {
    const { session, home, log, views } = homeSession()
    Tree.on(home.root.cards, 'nodeChanged', () => log.push('card added'))

    const card = await session.createRecipe('Soup')

    expect(log).toEqual(['create container-1', 'card added'])
    expect(card.containerId).toBe('container-1')
    expect(card.title).toBe('Soup')
    expect(card.id).toBe(views.get('container-1')!.root.id)
    expect(home.root.cards.findById(card.id)).toBe(card)
  })

  it('gives a new recipe a short id shared with its card', async () => {
    const { session, views } = homeSession()
    const card = await session.createRecipe('Soup')
    expect(card.id).toMatch(/^[A-Za-z0-9]{8}$/)
    expect(views.get(card.containerId)!.root.id).toBe(card.id)
  })

  it('stamps a new recipe with the book it was created in', async () => {
    const { session } = homeSession()
    const card = await session.createRecipe('Soup')
    expect(card.originBookId).toBe('home')
  })

  it('reports that it is showing the home book', () => {
    const { session, home } = homeSession()
    expect(session.isHome).toBe(true)
    expect(session.book).toBe(home.root)
    expect(session.homeBook).toBe(home.root)
    expect(session.bookId).toBe('home')
    expect(session.homeBookId).toBe('home')
  })

  it('createRecipe leaves the new recipe selected', async () => {
    const { session, views } = homeSession()
    const card = await session.createRecipe('Soup')
    expect(session.current?.card).toBe(card)
    expect(session.current?.recipe).toBe(views.get('container-1')!.root)
  })

  it('select opens the card’s container once and reuses it', async () => {
    const { session, log, views } = homeSession()
    const card = await session.createRecipe('Soup')
    session.deselect()
    await flush()
    log.length = 0

    const recipe = await session.select(card)
    expect(recipe).toBe(views.get('container-1')!.root)
    expect(log).toEqual(['open container-1'])

    const again = await session.select(card)
    expect(again).toBe(recipe)
    expect(log).toEqual(['open container-1'])
  })

  it('selecting a different card disposes the previous container after it is saved', async () => {
    const { session, log, holdSaved } = homeSession()
    const soup = await session.createRecipe('Soup')
    const bread = await session.createRecipe('Bread')
    await flush()
    log.length = 0

    const release = holdSaved('container-2')
    await session.select(soup)
    await flush()
    expect(session.current?.card).toBe(soup)
    expect(log).toEqual(['open container-1'])

    release()
    await flush()
    expect(log).toEqual(['open container-1', 'dispose container-2'])
    expect(bread.containerId).toBe('container-2')
  })

  it('brings a stale card up to date as soon as its recipe is opened', async () => {
    const { session, views } = homeSession()
    const card = await session.createRecipe('Soup')
    session.deselect()
    await flush()
    // Another client edited the recipe while nobody here had it open.
    views.get(card.containerId)!.root.title.insertAt(4, ' of the day')
    card.title = 'Soup'

    await session.select(card)
    expect(card.title).toBe('Soup of the day')
  })

  it('does not project a just-opened recipe until its container has caught up', async () => {
    const { session, views, holdConnected } = homeSession()
    const card = await session.createRecipe('Soup')
    session.deselect()
    await flush()
    views.get(card.containerId)!.root.title.insertAt(4, ' of the day')
    card.title = 'Old'

    const release = holdConnected(card.containerId)
    await session.select(card)
    await flush()
    expect(card.title).toBe('Old')

    release()
    await flush()
    expect(card.title).toBe('Soup of the day')
  })

  it('rejects when the container is missing and keeps the current selection', async () => {
    const { session, home } = homeSession()
    const soup = await session.createRecipe('Soup')
    const orphan = home.root.cards.add(
      new RecipeCard({
        containerId: 'container-999',
        title: 'Ghost',
        tags: {},
        updatedAt: 1,
      }),
    )

    await expect(session.select(orphan)).rejects.toThrow(/container-999/)
    expect(session.current?.card).toBe(soup)
    expect(home.root.cards.length).toBe(2)
  })

  it('saveToHome on a home card is a no-op that returns the card', async () => {
    const { session, home } = homeSession()
    const card = await session.createRecipe('Soup')
    expect(session.saveToHome(card)).toBe(card)
    expect(home.root.cards.length).toBe(1)
    expect(session.homeHas(card.id)).toBe(true)
  })

  it('deselect clears the selection and disposes the container', async () => {
    const { session, log } = homeSession()
    await session.createRecipe('Soup')
    session.deselect()
    await flush()
    expect(session.current).toBeUndefined()
    expect(log).toContain('dispose container-1')
  })

  it('close disposes whatever is open', async () => {
    const { session, log } = homeSession()
    await session.createRecipe('Soup')
    session.close()
    await flush()
    expect(session.current).toBeUndefined()
    expect(log).toContain('dispose container-1')
  })
})

describe('RecipeSession browsing another book', () => {
  it('shows the browsed book and knows it is not home', () => {
    const { session, home, theirs } = browsingSession()
    expect(session.isHome).toBe(false)
    expect(session.book).toBe(theirs.root)
    expect(session.homeBook).toBe(home.root)
    expect(session.bookId).toBe('theirs')
    expect(session.homeBookId).toBe('home')
  })

  it('creates recipes in the browsed book, stamped with that book', async () => {
    const { session, home, theirs } = browsingSession()
    const card = await session.createRecipe('Soup')
    expect(theirs.root.cards.findById(card.id)).toBe(card)
    expect(home.root.cards.length).toBe(0)
    expect(card.originBookId).toBe('theirs')
  })

  it('saveToHome copies the card into the home book, pointing at the same container', async () => {
    const { session, home, theirs } = browsingSession()
    const original = await session.createRecipe('Soup')
    await flush()
    session.current!.recipe.tags.add('dinner')

    const saved = session.saveToHome(original)

    expect(home.root.cards.length).toBe(1)
    expect(home.root.cards[0]).toBe(saved)
    expect(saved).not.toBe(original)
    expect(saved.id).toBe(original.id)
    expect(saved.containerId).toBe(original.containerId)
    expect(saved.title).toBe('Soup')
    expect([...saved.tags.keys()]).toEqual(['dinner'])
    expect(saved.originBookId).toBe('theirs')
    expect(theirs.root.cards.length).toBe(1)
  })

  it('saveToHome is idempotent', async () => {
    const { session, home } = browsingSession()
    const original = await session.createRecipe('Soup')
    expect(session.homeHas(original.id)).toBe(false)
    const first = session.saveToHome(original)
    expect(session.homeHas(original.id)).toBe(true)
    const second = session.saveToHome(original)
    expect(second).toBe(first)
    expect(home.root.cards.length).toBe(1)
  })

  describe('projection', () => {
    beforeEach(() => vi.useFakeTimers())
    afterEach(() => vi.useRealTimers())

    it('keeps both the browsed card and the saved home card in sync', async () => {
      const { session } = browsingSession()
      const original = await session.createRecipe('Soup')
      const saved = session.saveToHome(original)
      session.deselect()
      await vi.advanceTimersByTimeAsync(0)

      const recipe = await session.select(original)
      recipe.title.insertAt(4, ' of the day')
      recipe.tags.add('quick')
      await vi.advanceTimersByTimeAsync(300)

      expect(original.title).toBe('Soup of the day')
      expect(saved.title).toBe('Soup of the day')
      expect([...saved.tags.keys()]).toEqual(['quick'])
    })

    it('starts syncing the home card when it is saved after the recipe was opened', async () => {
      const { session } = browsingSession()
      const original = await session.createRecipe('Soup')
      const recipe = session.current!.recipe
      const saved = session.saveToHome(original)
      recipe.title.insertAt(4, ' of the day')
      await vi.advanceTimersByTimeAsync(300)
      expect(saved.title).toBe('Soup of the day')
    })

    it('stops syncing a recipe after switching away from it', async () => {
      const { session } = browsingSession()
      const soup = await session.createRecipe('Soup')
      const soupRecipe = session.current!.recipe
      await session.createRecipe('Bread')
      await vi.advanceTimersByTimeAsync(0)
      soupRecipe.title.insertAt(0, 'Cold ')
      await vi.advanceTimersByTimeAsync(500)
      expect(soup.title).toBe('Soup')
    })
  })
})
