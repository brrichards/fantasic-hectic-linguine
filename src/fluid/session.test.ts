import { Tree } from 'fluid-framework'
import { describe, expect, it } from 'vitest'
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
    const { session, home, log } = homeSession()
    Tree.on(home.root.cards, 'nodeChanged', () => log.push('card added'))

    const card = await session.createRecipe('Soup')

    expect(log).toEqual(['create container-1', 'card added'])
    expect(card.id).toBe('container-1')
    expect(card.title).toBe('Soup')
    expect(home.root.cards.findById(card.id)).toBe(card)
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
    expect(bread.id).toBe('container-2')
  })

  it('brings a stale card up to date as soon as its recipe is opened', async () => {
    const { session, views } = homeSession()
    const card = await session.createRecipe('Soup')
    session.deselect()
    await flush()
    // Another client edited the recipe while nobody here had it open.
    views.get(card.id)!.root.title.insertAt(4, ' of the day')
    card.title = 'Soup'

    await session.select(card)
    expect(card.title).toBe('Soup of the day')
  })

  it('does not project a just-opened recipe until its container has caught up', async () => {
    const { session, views, holdConnected } = homeSession()
    const card = await session.createRecipe('Soup')
    session.deselect()
    await flush()
    views.get(card.id)!.root.title.insertAt(4, ' of the day')
    card.title = 'Old'

    const release = holdConnected(card.id)
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
        id: 'container-999',
        title: 'Ghost',
        tags: {},
        authorId: 'home',
      }),
    )

    await expect(session.select(orphan)).rejects.toThrow(/container-999/)
    expect(session.current?.card).toBe(soup)
    expect(home.root.cards.length).toBe(2)
  })

  it('deselect clears the selection and disposes the container', async () => {
    const { session, log } = homeSession()
    await session.createRecipe('Soup')
    session.deselect()
    await flush()
    expect(session.current).toBeUndefined()
    expect(log).toContain('dispose container-1')
  })
})

describe('RecipeSession browsing another book', () => {
  it('creates recipes in the browsed book, stamped with that book', async () => {
    const { session, home, theirs } = browsingSession()
    const card = await session.createRecipe('Soup')
    expect(theirs.root.cards.findById(card.id)).toBe(card)
    expect(home.root.cards.length).toBe(0)
    expect(card.authorId).toBe('theirs')
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
    expect(saved.title).toBe('Soup')
    expect([...saved.tags.keys()]).toEqual(['dinner'])
    expect(saved.authorId).toBe('theirs')
    expect(theirs.root.cards.length).toBe(1)
  })

  describe('projection', () => {
    it('keeps both the browsed card and the saved home card in sync', async () => {
      const { session } = browsingSession()
      const original = await session.createRecipe('Soup')
      const saved = session.saveToHome(original)
      session.deselect()
      await flush()

      const recipe = await session.select(original)
      recipe.title.insertAt(4, ' of the day')
      recipe.tags.add('quick')

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
      expect(saved.title).toBe('Soup of the day')
    })

    it('stops syncing a recipe after switching away from it', async () => {
      const { session } = browsingSession()
      const soup = await session.createRecipe('Soup')
      const soupRecipe = session.current!.recipe
      await session.createRecipe('Bread')
      await flush()
      soupRecipe.title.insertAt(0, 'Cold ')
      expect(soup.title).toBe('Soup')
    })
  })
})
