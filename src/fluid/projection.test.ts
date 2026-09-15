import { createIndependentTreeView, type TreeViewBeta } from 'fluid-framework/beta'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { projectRecipe, syncCard, watchRecipeProjection } from './projection'
import { Recipe, RecipeBook, RecipeCard, bookConfig, recipeConfig } from './schema'

function makeRecipe(title = 'Soup') {
  const view = createIndependentTreeView(recipeConfig)
  view.initialize(Recipe.create(title))
  return view.root
}

function makeBookWithCard(recipe: Recipe) {
  const view = createIndependentTreeView(bookConfig)
  view.initialize(new RecipeBook({ cards: [] }))
  const card = view.root.cards.add(
    new RecipeCard({
      id: recipe.id,
      containerId: 'c1',
      title: recipe.title.fullString(),
      tags: {},
      visibility: 'edit',
      updatedAt: 1,
    }),
  )
  return { book: view.root, card, view }
}

/** Counts commits applied to the book, which is what one transaction produces. */
function countCommits(view: TreeViewBeta<typeof RecipeBook>) {
  let commits = 0
  view.events.on('commitApplied', () => {
    commits += 1
  })
  return () => commits
}

describe('projectRecipe', () => {
  it('copies the title and tags as plain strings', () => {
    const recipe = makeRecipe('Soup')
    recipe.tags.add('dinner')
    recipe.tags.add('vegan')
    expect(projectRecipe(recipe)).toEqual({ title: 'Soup', tags: ['dinner', 'vegan'] })
  })

  it('flattens the title to one trimmed line', () => {
    const recipe = makeRecipe('Hot')
    recipe.title.insertAt(3, '\nSoup\n')
    expect(projectRecipe(recipe).title).toBe('Hot Soup')
  })

  it('trims tags and drops empty ones', () => {
    const recipe = makeRecipe()
    recipe.tags.add(' dinner ')
    recipe.tags.add('   ')
    recipe.tags.add('')
    expect(projectRecipe(recipe).tags).toEqual(['dinner'])
  })
})

describe('syncCard', () => {
  it('writes title, tags, and a fresh timestamp when the projection differs', () => {
    const recipe = makeRecipe('Soup')
    const { card } = makeBookWithCard(recipe)
    recipe.title.insertAt(4, ' of the day')
    recipe.tags.add('dinner')
    const before = Date.now()
    expect(syncCard(card, recipe)).toBe(true)
    expect(card.title).toBe('Soup of the day')
    expect([...card.tags.keys()]).toEqual(['dinner'])
    expect(card.updatedAt).toBeGreaterThanOrEqual(before)
  })

  it('writes nothing when the card already matches', () => {
    const recipe = makeRecipe('Soup')
    const { card, view } = makeBookWithCard(recipe)
    const writes = countCommits(view)
    expect(syncCard(card, recipe)).toBe(false)
    expect(card.updatedAt).toBe(1)
    expect(writes()).toBe(0)
  })

  it('writes the whole projection as a single commit', () => {
    const recipe = makeRecipe('Soup')
    const { card, view } = makeBookWithCard(recipe)
    const writes = countCommits(view)
    recipe.title.insertAt(4, '!')
    recipe.tags.add('quick')
    syncCard(card, recipe)
    expect(writes()).toBe(1)
  })

  it('removes tags that are gone and keeps the ones that remain', () => {
    const recipe = makeRecipe('Soup')
    const { card } = makeBookWithCard(recipe)
    recipe.tags.add('dinner')
    recipe.tags.add('vegan')
    syncCard(card, recipe)
    recipe.tags.removeAt(0)
    recipe.tags.add('quick')
    syncCard(card, recipe)
    expect([...card.tags.keys()].sort()).toEqual(['quick', 'vegan'])
  })

  it('converges to one copy of each tag when two clients project at once', () => {
    const recipe = makeRecipe('Soup')
    const { view } = makeBookWithCard(recipe)
    recipe.tags.add('dinner')
    // A fork behaves like a second client editing the same book concurrently.
    const other = view.fork()
    syncCard(view.root.cards[0], recipe)
    syncCard(other.root.cards[0], recipe)
    view.merge(other)
    expect([...view.root.cards[0].tags.keys()]).toEqual(['dinner'])
  })

  it('is a no-op once the card has been removed from its book', () => {
    const recipe = makeRecipe('Soup')
    const { book, card } = makeBookWithCard(recipe)
    book.cards.removeById(card.id)
    recipe.title.insertAt(4, '!')
    expect(() => syncCard(card, recipe)).not.toThrow()
    expect(syncCard(card, recipe)).toBe(false)
  })
})

describe('watchRecipeProjection', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('does not touch the card until the delay has passed', () => {
    const recipe = makeRecipe('Soup')
    const { card } = makeBookWithCard(recipe)
    watchRecipeProjection(recipe, [card], 300)
    recipe.title.insertAt(4, '!')
    vi.advanceTimersByTime(299)
    expect(card.title).toBe('Soup')
    vi.advanceTimersByTime(1)
    expect(card.title).toBe('Soup!')
  })

  it('coalesces a burst of edits into one write', () => {
    const recipe = makeRecipe('Soup')
    const { card, view } = makeBookWithCard(recipe)
    const writes = countCommits(view)
    watchRecipeProjection(recipe, [card], 300)
    recipe.title.insertAt(4, ' ')
    vi.advanceTimersByTime(100)
    recipe.title.insertAt(5, 'o')
    vi.advanceTimersByTime(100)
    recipe.title.insertAt(6, 'f')
    vi.advanceTimersByTime(300)
    expect(card.title).toBe('Soup of')
    expect(writes()).toBe(1)
  })

  it('reacts to tag edits as well as title edits', () => {
    const recipe = makeRecipe('Soup')
    const { card } = makeBookWithCard(recipe)
    watchRecipeProjection(recipe, [card], 300)
    recipe.tags.add('dinner')
    vi.advanceTimersByTime(300)
    expect([...card.tags.keys()]).toEqual(['dinner'])
    recipe.tags[0].insertAt(6, ' party')
    vi.advanceTimersByTime(300)
    expect([...card.tags.keys()]).toEqual(['dinner party'])
  })

  it('ignores edits to fields that are not projected', () => {
    const recipe = makeRecipe('Soup')
    const { card, view } = makeBookWithCard(recipe)
    const writes = countCommits(view)
    watchRecipeProjection(recipe, [card], 300)
    recipe.description.insertAt(0, 'Warm')
    recipe.servings = 4
    recipe.steps.insertAt(0, 'Simmer')
    vi.advanceTimersByTime(1000)
    expect(writes()).toBe(0)
  })

  it('keeps every card it is given in sync, across books', () => {
    const recipe = makeRecipe('Soup')
    const { card: theirs } = makeBookWithCard(recipe)
    const { card: mine } = makeBookWithCard(recipe)
    watchRecipeProjection(recipe, [theirs, mine], 300)
    recipe.title.insertAt(4, ' of the day')
    recipe.tags.add('dinner')
    vi.advanceTimersByTime(300)
    expect(theirs.title).toBe('Soup of the day')
    expect(mine.title).toBe('Soup of the day')
    expect([...mine.tags.keys()]).toEqual(['dinner'])
  })

  it('stops writing after dispose, including a pending write', () => {
    const recipe = makeRecipe('Soup')
    const { card } = makeBookWithCard(recipe)
    const stop = watchRecipeProjection(recipe, [card], 300)
    recipe.title.insertAt(4, '!')
    stop()
    vi.advanceTimersByTime(1000)
    expect(card.title).toBe('Soup')
    recipe.title.insertAt(5, '?')
    vi.advanceTimersByTime(1000)
    expect(card.title).toBe('Soup')
  })
})
