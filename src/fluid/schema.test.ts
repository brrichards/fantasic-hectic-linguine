import { createIndependentTreeView } from 'fluid-framework/beta'
import { describe, expect, it } from 'vitest'
import {
  Recipe,
  RecipeBook,
  RecipeCard,
  RichText,
  bookConfig,
  recipeConfig,
  visibilities,
} from './schema'

/** A hydrated recipe, as it would be the root of a recipe container. */
function makeRecipe(title = 'Soup') {
  const view = createIndependentTreeView(recipeConfig)
  view.initialize(Recipe.create(title))
  return view.root
}

/** A hydrated, empty book, as it would be the root of a book container. */
function makeBook() {
  const view = createIndependentTreeView(bookConfig)
  view.initialize(new RecipeBook({ cards: [] }))
  return view.root
}

function makeCard(overrides: Partial<ConstructorParameters<typeof RecipeCard>[0]> = {}) {
  return new RecipeCard({
    containerId: 'container-1',
    title: 'Soup',
    tags: {},
    visibility: 'edit',
    updatedAt: 1000,
    ...overrides,
  })
}

describe('RichText', () => {
  it('round-trips a string through fromString and fullString', () => {
    const text = RichText.fromString('Pasta')
    expect(text.fullString()).toBe('Pasta')
    expect(text.characterCount()).toBe(5)
  })

  it('counts an emoji as one character', () => {
    const text = RichText.fromString('a😀b')
    expect(text.characterCount()).toBe(3)
    expect(text.fullString()).toBe('a😀b')
  })
})

describe('Recipe.create', () => {
  it('builds a recipe with the given title and empty collections', () => {
    const recipe = makeRecipe('Soup')
    expect(recipe.title.fullString()).toBe('Soup')
    expect(recipe.description.fullString()).toBe('')
    expect(recipe.sourceUrl.fullString()).toBe('')
    expect(recipe.servings).toBeUndefined()
    expect(recipe.prepMinutes).toBeUndefined()
    expect(recipe.cookMinutes).toBeUndefined()
    expect(recipe.ingredients.length).toBe(0)
    expect(recipe.steps.length).toBe(0)
    expect(recipe.tags.length).toBe(0)
    expect(recipe.notes.length).toBe(0)
  })

  it('generates a distinct non-empty id per recipe', () => {
    const a = makeRecipe('A')
    const b = makeRecipe('B')
    expect(a.id.length).toBeGreaterThan(0)
    expect(a.id).not.toBe(b.id)
  })

  it('uses an explicit id when one is given', () => {
    const view = createIndependentTreeView(recipeConfig)
    view.initialize(Recipe.create('Soup', 'recipe-42'))
    expect(view.root.id).toBe('recipe-42')
  })
})

describe('RecipeBook and cards', () => {
  it('starts with no cards', () => {
    expect(makeBook().cards.length).toBe(0)
  })

  it('cards.add appends a card and generates its id when none is given', () => {
    const book = makeBook()
    const card = book.cards.add(makeCard())
    expect(book.cards.length).toBe(1)
    expect(book.cards[0]).toBe(card)
    expect(card.id.length).toBeGreaterThan(0)
    expect(card.containerId).toBe('container-1')
    expect(card.title).toBe('Soup')
    expect(card.visibility).toBe('edit')
    expect(card.originBookId).toBeUndefined()
  })

  it('a card can carry the id of the recipe it points at', () => {
    const recipe = makeRecipe()
    const card = makeBook().cards.add(makeCard({ id: recipe.id }))
    expect(card.id).toBe(recipe.id)
  })

  it('cards hold a set of tags and the id of the book the recipe was created in', () => {
    const card = makeBook().cards.add(
      makeCard({ tags: { dinner: true, vegan: true }, originBookId: 'book-of-bren' }),
    )
    expect([...card.tags.keys()].sort()).toEqual(['dinner', 'vegan'])
    expect(card.originBookId).toBe('book-of-bren')
  })

  it('findById returns the matching card or undefined', () => {
    const book = makeBook()
    const a = book.cards.add(makeCard({ id: 'a' }))
    book.cards.add(makeCard({ id: 'b' }))
    expect(book.cards.findById('a')).toBe(a)
    expect(book.cards.findById('zzz')).toBeUndefined()
  })

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

  it('lists the visibility values the UI may offer', () => {
    expect(visibilities).toEqual(['private', 'view', 'edit'])
  })
})

describe('Recipe collections', () => {
  it('ingredients.add appends a blank ingredient', () => {
    const recipe = makeRecipe()
    const ingredient = recipe.ingredients.add()
    expect(recipe.ingredients.length).toBe(1)
    expect(ingredient.id.length).toBeGreaterThan(0)
    expect(ingredient.quantity).toBeUndefined()
    expect(ingredient.unit.fullString()).toBe('')
    expect(ingredient.name.fullString()).toBe('')
    expect(ingredient.note.fullString()).toBe('')
  })

  it('ingredient fields can be edited in place', () => {
    const recipe = makeRecipe()
    const ingredient = recipe.ingredients.add()
    ingredient.quantity = 2
    ingredient.name.insertAt(0, 'carrots')
    expect(recipe.ingredients[0].quantity).toBe(2)
    expect(recipe.ingredients[0].name.fullString()).toBe('carrots')
  })

  it('steps.add appends a blank step', () => {
    const recipe = makeRecipe()
    const step = recipe.steps.add()
    expect(recipe.steps.length).toBe(1)
    expect(step.id.length).toBeGreaterThan(0)
    expect(step.text.fullString()).toBe('')
  })

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

  it('tags.add appends a tag holding the given text', () => {
    const recipe = makeRecipe()
    recipe.tags.add('dinner')
    recipe.tags.add('vegan')
    expect(recipe.tags.map((tag) => tag.fullString())).toEqual(['dinner', 'vegan'])
  })

  it('removeAt drops an ingredient', () => {
    const recipe = makeRecipe()
    recipe.ingredients.add()
    const keep = recipe.ingredients.add()
    recipe.ingredients.removeAt(0)
    expect(recipe.ingredients.length).toBe(1)
    expect(recipe.ingredients[0]).toBe(keep)
  })
})

describe('ordered collection move', () => {
  function stepsNamed(labels: string[]) {
    const recipe = makeRecipe()
    for (const label of labels) {
      const step = recipe.steps.add()
      step.text.insertAt(0, label)
    }
    return recipe.steps
  }
  const labels = (steps: { text: { fullString(): string } }[]) =>
    steps.map((s) => s.text.fullString())

  it('moves an item toward the front, preserving node identity', () => {
    const steps = stepsNamed(['a', 'b', 'c'])
    const moved = steps[2]
    steps.move(2, 0)
    expect(labels([...steps])).toEqual(['c', 'a', 'b'])
    expect(steps[0]).toBe(moved)
  })

  it('moves an item toward the back', () => {
    const steps = stepsNamed(['a', 'b', 'c'])
    steps.move(0, 2)
    expect(labels([...steps])).toEqual(['b', 'c', 'a'])
  })

  it('moves an adjacent item down by one', () => {
    const steps = stepsNamed(['a', 'b', 'c'])
    steps.move(0, 1)
    expect(labels([...steps])).toEqual(['b', 'a', 'c'])
  })

  it('moving an item onto itself is a no-op', () => {
    const steps = stepsNamed(['a', 'b', 'c'])
    steps.move(1, 1)
    expect(labels([...steps])).toEqual(['a', 'b', 'c'])
  })

  it('works the same on ingredients', () => {
    const recipe = makeRecipe()
    const first = recipe.ingredients.add()
    recipe.ingredients.add()
    recipe.ingredients.move(0, 1)
    expect(recipe.ingredients[1]).toBe(first)
  })
})
