import { createIndependentTreeView } from 'fluid-framework/beta'
import { describe, expect, it } from 'vitest'
import { cardFor, projectRecipe, syncCard, watchRecipeProjection } from './projection'
import { Recipe, RecipeCard, recipeConfig } from './schema'
import { makeBookView } from '../test/fakeContainerSource'

function makeRecipe(title = 'Soup') {
  const view = createIndependentTreeView(recipeConfig)
  view.initialize(Recipe.create(title, 'home'))
  return view.root
}

function makeBookWithCard(recipe: Recipe) {
  const view = makeBookView()
  const card = view.root.cards.add(
    new RecipeCard({
      id: 'c1',
      title: recipe.title.fullString(),
      tags: {},
      authorId: 'home',
    }),
  )
  return { book: view.root, card }
}

describe('projectRecipe', () => {
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

describe('cardFor', () => {
  it('builds a card from the projection of the recipe', () => {
    const recipe = makeRecipe('Hot\nSoup')
    recipe.tags.add('dinner')
    const card = cardFor('c9', recipe)
    expect(card.id).toBe('c9')
    expect(card.title).toBe('Hot Soup')
    expect([...card.tags.keys()]).toEqual(['dinner'])
    expect(card.authorId).toBe('home')
  })
})

describe('syncCard', () => {
  it('writes the title and tags when the projection differs', () => {
    const recipe = makeRecipe('Soup')
    const { card } = makeBookWithCard(recipe)
    recipe.title.insertAt(4, ' of the day')
    recipe.tags.add('dinner')
    expect(syncCard(card, recipe)).toBe(true)
    expect(card.title).toBe('Soup of the day')
    expect([...card.tags.keys()]).toEqual(['dinner'])
  })

  it('writes nothing when the card already matches', () => {
    const recipe = makeRecipe('Soup')
    const { card } = makeBookWithCard(recipe)
    expect(syncCard(card, recipe)).toBe(false)
  })

  it('brings a card that names the wrong author in line with the recipe', () => {
    const recipe = makeRecipe('Soup')
    const { card } = makeBookWithCard(recipe)
    card.authorId = 'someone-else'
    expect(syncCard(card, recipe)).toBe(true)
    expect(card.authorId).toBe('home')
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
  it('writes title and tag changes to the card as they happen', () => {
    const recipe = makeRecipe('Soup')
    const { card } = makeBookWithCard(recipe)
    watchRecipeProjection(recipe, () => [card])
    recipe.title.insertAt(4, '!')
    expect(card.title).toBe('Soup!')
    recipe.tags.add('dinner')
    expect([...card.tags.keys()]).toEqual(['dinner'])
    recipe.tags[0].insertAt(6, ' party')
    expect([...card.tags.keys()]).toEqual(['dinner party'])
  })
})
