import { fireEvent, render, screen, within } from '@testing-library/react'
import { createIndependentTreeView } from 'fluid-framework/beta'
import { act } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { Recipe, RecipeCard, recipeConfig } from '../fluid/schema'
import { makeBookView } from '../test/fakeContainerSource'
import { RecipeDetail } from './RecipeDetail'

function makeRecipe() {
  const view = createIndependentTreeView(recipeConfig)
  view.initialize(Recipe.create('Soup'))
  const recipe = view.root
  const card = makeBookView().root.cards.add(
    new RecipeCard({
      id: recipe.id,
      containerId: 'container-1',
      title: 'Soup',
      tags: {},
      visibility: 'edit',
      updatedAt: 1,
    }),
  )
  return { recipe, card }
}

function renderDetail(extra: Partial<Parameters<typeof RecipeDetail>[0]> = {}) {
  const { recipe, card } = makeRecipe()
  const result = render(<RecipeDetail recipe={recipe} card={card} {...extra} />)
  return { recipe, card, ...result }
}

const list = (name: string) => screen.getByRole('list', { name })
const rows = (name: string) => within(list(name)).queryAllByRole('listitem')
const editorTexts = (row: HTMLElement) =>
  [...row.querySelectorAll('.ql-editor')].map((el) => el.textContent)

describe('RecipeDetail', () => {
  it('shows the recipe text fields in editors', () => {
    const { recipe, card } = makeRecipe()
    recipe.description.insertAt(0, 'Warm and filling')
    recipe.sourceUrl.insertAt(0, 'https://example.com')
    render(<RecipeDetail recipe={recipe} card={card} />)
    const texts = [...document.querySelectorAll('.ql-editor')].map((el) => el.textContent)
    expect(texts).toContain('Soup')
    expect(texts).toContain('Warm and filling')
    expect(texts).toContain('https://example.com')
  })

  it('binds the numeric fields both ways', () => {
    const { recipe, card } = makeRecipe()
    recipe.prepMinutes = 10
    render(<RecipeDetail recipe={recipe} card={card} />)
    const servings = screen.getByRole('spinbutton', { name: /servings/i })
    expect(servings).toHaveValue(null)
    expect(screen.getByRole('spinbutton', { name: /prep/i })).toHaveValue(10)

    fireEvent.change(servings, { target: { value: '4' } })
    expect(recipe.servings).toBe(4)
    fireEvent.change(servings, { target: { value: '' } })
    expect(recipe.servings).toBeUndefined()

    act(() => {
      recipe.cookMinutes = 25
    })
    expect(screen.getByRole('spinbutton', { name: /cook/i })).toHaveValue(25)
  })

  it('binds the visibility picker to the card both ways', () => {
    const { card } = renderDetail()
    const picker = screen.getByRole('combobox', { name: /visibility/i })
    expect(picker).toHaveValue('edit')
    expect([...picker.querySelectorAll('option')].map((o) => o.value)).toEqual([
      'private',
      'view',
      'edit',
    ])

    fireEvent.change(picker, { target: { value: 'view' } })
    expect(card.visibility).toBe('view')

    act(() => {
      card.visibility = 'private'
    })
    expect(picker).toHaveValue('private')
  })

  it('offers to save the recipe when a save handler is given', () => {
    const onSave = vi.fn()
    renderDetail({ onSave, saved: false })
    fireEvent.click(screen.getByRole('button', { name: /save to my book/i }))
    expect(onSave).toHaveBeenCalledTimes(1)
  })

  it('shows a disabled saved state once saved', () => {
    renderDetail({ onSave: () => {}, saved: true })
    expect(screen.getByRole('button', { name: /saved/i })).toBeDisabled()
  })

  it('shows no save button without a save handler', () => {
    renderDetail()
    expect(screen.queryByRole('button', { name: /save/i })).toBeNull()
  })

  it('adds, edits, and removes ingredients', () => {
    const { recipe } = renderDetail()
    expect(rows('Ingredients')).toHaveLength(0)

    fireEvent.click(screen.getByRole('button', { name: /add ingredient/i }))
    expect(recipe.ingredients.length).toBe(1)
    expect(rows('Ingredients')).toHaveLength(1)

    const quantity = within(rows('Ingredients')[0]).getByRole('spinbutton', { name: /quantity/i })
    fireEvent.change(quantity, { target: { value: '2.5' } })
    expect(recipe.ingredients[0].quantity).toBe(2.5)

    fireEvent.click(within(rows('Ingredients')[0]).getByRole('button', { name: /remove/i }))
    expect(recipe.ingredients.length).toBe(0)
    expect(rows('Ingredients')).toHaveLength(0)
  })

  it('reorders ingredients with move buttons', () => {
    const { recipe, card } = makeRecipe()
    for (const name of ['flour', 'eggs', 'milk']) recipe.ingredients.add().name.insertAt(0, name)
    render(<RecipeDetail recipe={recipe} card={card} />)
    const names = () => rows('Ingredients').map((row) => editorTexts(row)[1])
    expect(names()).toEqual(['flour', 'eggs', 'milk'])

    fireEvent.click(within(rows('Ingredients')[2]).getByRole('button', { name: /move up/i }))
    expect(names()).toEqual(['flour', 'milk', 'eggs'])

    fireEvent.click(within(rows('Ingredients')[0]).getByRole('button', { name: /move down/i }))
    expect(names()).toEqual(['milk', 'flour', 'eggs'])
    expect(recipe.ingredients.map((i) => i.name.fullString())).toEqual(['milk', 'flour', 'eggs'])
  })

  it('disables move up on the first row and move down on the last', () => {
    const { recipe, card } = makeRecipe()
    recipe.steps.add()
    recipe.steps.add()
    render(<RecipeDetail recipe={recipe} card={card} />)
    expect(within(rows('Steps')[0]).getByRole('button', { name: /move up/i })).toBeDisabled()
    expect(within(rows('Steps')[1]).getByRole('button', { name: /move down/i })).toBeDisabled()
  })

  it('adds and removes steps', () => {
    const { recipe } = renderDetail()
    fireEvent.click(screen.getByRole('button', { name: /add step/i }))
    fireEvent.click(screen.getByRole('button', { name: /add step/i }))
    expect(recipe.steps.length).toBe(2)
    expect(rows('Steps')).toHaveLength(2)
    fireEvent.click(within(rows('Steps')[0]).getByRole('button', { name: /remove/i }))
    expect(recipe.steps.length).toBe(1)
  })

  it('adds a tag from the tag form and removes it', () => {
    const { recipe } = renderDetail()
    const input = screen.getByRole('textbox', { name: /new tag/i })
    fireEvent.change(input, { target: { value: 'dinner' } })
    fireEvent.click(screen.getByRole('button', { name: /add tag/i }))
    expect(recipe.tags.map((t) => t.fullString())).toEqual(['dinner'])
    expect(input).toHaveValue('')
    expect(editorTexts(rows('Tags')[0])).toEqual(['dinner'])

    fireEvent.click(within(rows('Tags')[0]).getByRole('button', { name: /remove/i }))
    expect(recipe.tags.length).toBe(0)
  })

  it('adds a note with the given author', () => {
    const { recipe } = renderDetail()
    fireEvent.change(screen.getByRole('textbox', { name: /author/i }), { target: { value: 'Bren' } })
    fireEvent.click(screen.getByRole('button', { name: /add note/i }))
    expect(recipe.notes.length).toBe(1)
    expect(recipe.notes[0].author.fullString()).toBe('Bren')
    expect(editorTexts(rows('Notes')[0])).toContain('Bren')
  })

  it('shows rows added outside the component', () => {
    const { recipe } = renderDetail()
    act(() => {
      recipe.ingredients.add()
      recipe.steps.add()
      recipe.tags.add('quick')
      recipe.notes.add('Sam')
    })
    expect(rows('Ingredients')).toHaveLength(1)
    expect(rows('Steps')).toHaveLength(1)
    expect(rows('Tags')).toHaveLength(1)
    expect(rows('Notes')).toHaveLength(1)
  })
})
