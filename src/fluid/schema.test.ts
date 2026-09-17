import { TreeViewConfiguration } from 'fluid-framework'
import { createIndependentTreeAlpha } from 'fluid-framework/alpha'
import { SchemaFactoryBeta, createIndependentTreeView } from 'fluid-framework/beta'
import { describe, expect, it } from 'vitest'
import { Duration, Quantity, Recipe, RecipeCard, RecipeCards, bookConfig, recipeConfig } from './schema'
import { makeBookView } from '../test/fakeContainerSource'

/** A hydrated recipe, as it would be the root of a recipe container. */
function makeRecipe(title = 'Soup') {
  const view = createIndependentTreeView(recipeConfig)
  view.initialize(Recipe.create(title, 'book-a'))
  return view.root
}

/** A hydrated, empty book, as it would be the root of a book container. */
function makeBook() {
  return makeBookView().root
}

function makeCard(overrides: Partial<ConstructorParameters<typeof RecipeCard>[0]> = {}) {
  return new RecipeCard({
    id: 'container-1',
    title: 'Soup',
    tags: {},
    authorId: 'book-a',
    ...overrides,
  })
}

describe('Duration.create and Quantity.create', () => {
  it('round the value to hundredths', () => {
    expect(Duration.create(1.234, 'hours').value).toBe(1.23)
    expect(Duration.create(1.235, 'hours').value).toBe(1.24)
    expect(Duration.create(0.005, 'minutes').value).toBe(0.01)
    expect(Quantity.create(1.005, 'lb').value).toBe(1.01)
  })
})

describe('Recipe.create', () => {
  it('builds a recipe with the given title and empty collections', () => {
    const recipe = makeRecipe('Soup')
    expect(recipe.title.fullString()).toBe('Soup')
    expect(recipe.description.fullString()).toBe('')
    expect(recipe.sourceUrl.fullString()).toBe('')
    expect(recipe.servings).toBeUndefined()
    expect(recipe.prepTime).toBeUndefined()
    expect(recipe.cookTime).toBeUndefined()
    expect(recipe.ingredients.length).toBe(0)
    expect(recipe.steps.fullString()).toBe('')
    expect(recipe.tags.length).toBe(0)
    expect(recipe.notes.length).toBe(0)
    expect(recipe.authorId).toBe('book-a')
    expect(recipe.othersMayEdit).toBe(true)
  })
})

describe('RecipeBook name', () => {
  it('keeps the name a book was created with', () => {
    expect(makeBookView('Carol').root.name).toBe('Carol')
  })

  it('refuses a book made before books had names', () => {
    const sf = new SchemaFactoryBeta('fhl.recipes')
    class NamelessBook extends sf.object('RecipeBook', { cards: RecipeCards }) {}
    const tree = createIndependentTreeAlpha()
    const before = tree.viewWith(new TreeViewConfiguration({ schema: NamelessBook }))
    before.initialize(new NamelessBook({ cards: [makeCard({ id: 'a' })] }))
    before.dispose()

    const view = tree.viewWith(bookConfig)
    expect(view.compatibility.canView).toBe(false)
    expect(view.compatibility.canUpgrade).toBe(false)
  })
})

describe('RecipeBook and cards', () => {
  it('removeById removes only the matching card', () => {
    const book = makeBook()
    book.cards.add(makeCard({ id: 'a' }))
    const b = book.cards.add(makeCard({ id: 'b' }))
    book.cards.removeById('a')
    expect(book.cards.length).toBe(1)
    expect(book.cards[0]).toBe(b)
    book.cards.removeById('missing')
    expect(book.cards.length).toBe(1)
  })
})

describe('Recipe collections', () => {
  it('notes.add records the author and a creation timestamp', () => {
    const recipe = makeRecipe()
    const before = Date.now()
    const note = recipe.notes.add('Bren')
    const after = Date.now()
    expect(recipe.notes.length).toBe(1)
    expect(note.id.length).toBeGreaterThan(0)
    expect(note.author.fullString()).toBe('Bren')
    expect(note.text.fullString()).toBe('')
    expect(note.createdAt).toBeGreaterThanOrEqual(before)
    expect(note.createdAt).toBeLessThanOrEqual(after)
  })
})
