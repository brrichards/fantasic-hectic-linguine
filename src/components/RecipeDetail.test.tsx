import { fireEvent, render, screen, within } from '@testing-library/react'
import { createIndependentTreeView } from 'fluid-framework/beta'
import { act } from 'react'
import { describe, expect, it } from 'vitest'
import { Duration, Quantity, Recipe, durationUnits, quantityUnits, recipeConfig } from '../fluid/schema'
import { RecipeDetail } from './RecipeDetail'

function makeRecipe() {
  const view = createIndependentTreeView(recipeConfig)
  view.initialize(Recipe.create('Soup', 'home'))
  return view.root
}

function renderDetail(extra: Partial<Parameters<typeof RecipeDetail>[0]> = {}) {
  const recipe = makeRecipe()
  const result = render(<RecipeDetail recipe={recipe} {...extra} />)
  return { recipe, ...result }
}

const list = (name: string) => screen.getByRole('list', { name })
const rows = (name: string) => within(list(name)).queryAllByRole('listitem')
const editorTexts = (row: HTMLElement) => [...row.querySelectorAll('.ql-editor')].map((el) => el.textContent)

describe('RecipeDetail', () => {
  it('shows the recipe text fields in editors', () => {
    const recipe = makeRecipe()
    recipe.description.insertAt(0, 'Warm and filling')
    recipe.sourceUrl.insertAt(0, 'https://example.com')
    recipe.steps.insertAt(0, 'Simmer gently')
    render(<RecipeDetail recipe={recipe} />)
    const texts = [...document.querySelectorAll('.ql-editor')].map((el) => el.textContent)
    expect(texts).toContain('Soup')
    expect(texts).toContain('Warm and filling')
    expect(texts).toContain('https://example.com')
    expect(texts).toContain('Simmer gently')
    expect(screen.queryByRole('button', { name: /add step/i })).toBeNull()
  })

  it('binds the servings field both ways', () => {
    const recipe = makeRecipe()
    render(<RecipeDetail recipe={recipe} />)
    const servings = screen.getByRole('spinbutton', { name: /servings/i })
    expect(servings).toHaveValue(null)

    fireEvent.change(servings, { target: { value: '4' } })
    expect(recipe.servings).toBe(4)
    fireEvent.change(servings, { target: { value: '' } })
    expect(recipe.servings).toBeUndefined()

    act(() => {
      recipe.servings = 6
    })
    expect(servings).toHaveValue(6)
  })

  it('shows a stored duration with its unit', () => {
    const recipe = makeRecipe()
    recipe.prepTime = Duration.create(10, 'minutes')
    render(<RecipeDetail recipe={recipe} />)
    expect(screen.getByRole('spinbutton', { name: /prep time/i })).toHaveValue(10)
    expect(screen.getByRole('combobox', { name: /prep time unit/i })).toHaveValue('minutes')

    act(() => {
      recipe.cookTime = Duration.create(2, 'days')
    })
    expect(screen.getByRole('spinbutton', { name: /cook time/i })).toHaveValue(2)
    expect(screen.getByRole('combobox', { name: /cook time unit/i })).toHaveValue('days')
  })

  it('stores a duration in the unit chosen before the number was typed', () => {
    const recipe = makeRecipe()
    render(<RecipeDetail recipe={recipe} />)
    const unit = screen.getByRole('combobox', { name: /prep time unit/i })
    const amount = screen.getByRole('spinbutton', { name: /prep time/i })
    expect(unit).toHaveValue('minutes')
    expect([...unit.querySelectorAll('option')].map((o) => o.value)).toEqual([...durationUnits])

    fireEvent.change(unit, { target: { value: 'hours' } })
    expect(recipe.prepTime).toBeUndefined()
    expect(unit).toHaveValue('hours')

    fireEvent.change(amount, { target: { value: '1.5' } })
    expect(recipe.prepTime?.value).toBe(1.5)
    expect(recipe.prepTime?.unit).toBe('hours')
  })

  it('changes the unit of a stored duration and rounds to hundredths', () => {
    const recipe = makeRecipe()
    recipe.cookTime = Duration.create(3, 'hours')
    render(<RecipeDetail recipe={recipe} />)
    const unit = screen.getByRole('combobox', { name: /cook time unit/i })
    const amount = screen.getByRole('spinbutton', { name: /cook time/i })

    fireEvent.change(unit, { target: { value: 'days' } })
    expect(recipe.cookTime?.value).toBe(3)
    expect(recipe.cookTime?.unit).toBe('days')

    fireEvent.change(amount, { target: { value: '1.239' } })
    expect(recipe.cookTime?.value).toBe(1.24)
    expect(amount).toHaveValue(1.24)

    fireEvent.change(amount, { target: { value: '' } })
    expect(recipe.cookTime).toBeUndefined()
    expect(unit).toHaveValue('days')
  })

  it('lets the author toggle whether others may edit, in both modes', () => {
    const recipe = makeRecipe()
    render(<RecipeDetail recipe={recipe} isAuthor />)
    const box = screen.getByRole('checkbox', { name: /allow others to edit/i })
    expect(box).toBeChecked()

    fireEvent.click(box)
    expect(recipe.othersMayEdit).toBe(false)
    expect(box).not.toBeChecked()

    act(() => {
      recipe.othersMayEdit = true
    })
    expect(box).toBeChecked()

    fireEvent.click(screen.getByRole('button', { name: 'View' }))
    expect(screen.getByRole('checkbox', { name: /allow others to edit/i })).toBeInTheDocument()
  })

  it('holds non-authors in view mode while others may not edit', () => {
    const recipe = makeRecipe()
    recipe.othersMayEdit = false
    render(<RecipeDetail recipe={recipe} initialMode="edit" />)
    expect(document.querySelector('.ql-editor')).toBeNull()
    expect(screen.getByRole('button', { name: 'Edit' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'View', pressed: true })).toBeInTheDocument()

    act(() => {
      recipe.othersMayEdit = true
    })
    expect(screen.getByRole('button', { name: 'Edit' })).toBeEnabled()
    expect(document.querySelector('.ql-editor')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    expect(document.querySelectorAll('.ql-editor').length).toBeGreaterThan(0)

    act(() => {
      recipe.othersMayEdit = false
    })
    expect(document.querySelector('.ql-editor')).toBeNull()
    expect(screen.getByRole('button', { name: 'View', pressed: true })).toBeInTheDocument()
  })

  it('lets the author edit even when others may not', () => {
    const recipe = makeRecipe()
    recipe.othersMayEdit = false
    render(<RecipeDetail recipe={recipe} isAuthor />)
    expect(screen.getByRole('button', { name: 'Edit' })).toBeEnabled()
    expect(document.querySelectorAll('.ql-editor').length).toBeGreaterThan(0)
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

    const row = within(rows('Ingredients')[0])
    const quantity = row.getByRole('spinbutton', { name: /quantity/i })
    const unit = row.getByRole('combobox', { name: /quantity unit/i })
    expect(unit).toHaveValue('none')
    expect([...unit.querySelectorAll('option')].map((o) => o.value)).toEqual([...quantityUnits])
    fireEvent.change(unit, { target: { value: 'cup' } })
    fireEvent.change(quantity, { target: { value: '2.555' } })
    expect(recipe.ingredients[0].quantity?.value).toBe(2.56)
    expect(recipe.ingredients[0].quantity?.unit).toBe('cup')
    expect(quantity).toHaveValue(2.56)

    fireEvent.click(within(rows('Ingredients')[0]).getByRole('button', { name: /remove/i }))
    expect(recipe.ingredients.length).toBe(0)
    expect(rows('Ingredients')).toHaveLength(0)
  })

  it('reorders ingredients with move buttons', () => {
    const recipe = makeRecipe()
    for (const name of ['flour', 'eggs', 'milk']) recipe.ingredients.add().name.insertAt(0, name)
    render(<RecipeDetail recipe={recipe} />)
    const names = () => rows('Ingredients').map((row) => editorTexts(row)[0])
    expect(names()).toEqual(['flour', 'eggs', 'milk'])

    fireEvent.click(within(rows('Ingredients')[2]).getByRole('button', { name: /move up/i }))
    expect(names()).toEqual(['flour', 'milk', 'eggs'])

    fireEvent.click(within(rows('Ingredients')[0]).getByRole('button', { name: /move down/i }))
    expect(names()).toEqual(['milk', 'flour', 'eggs'])
    expect(recipe.ingredients.map((i) => i.name.fullString())).toEqual(['milk', 'flour', 'eggs'])
  })

  it('disables move up on the first row and move down on the last', () => {
    const recipe = makeRecipe()
    recipe.ingredients.add()
    recipe.ingredients.add()
    render(<RecipeDetail recipe={recipe} />)
    expect(within(rows('Ingredients')[0]).getByRole('button', { name: /move up/i })).toBeDisabled()
    expect(within(rows('Ingredients')[1]).getByRole('button', { name: /move down/i })).toBeDisabled()
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
      recipe.tags.add('quick')
      recipe.notes.add('Sam')
    })
    expect(rows('Ingredients')).toHaveLength(1)
    expect(rows('Tags')).toHaveLength(1)
    expect(rows('Notes')).toHaveLength(1)
  })
})

describe('RecipeDetail in view mode', () => {
  function filledRecipe() {
    const recipe = makeRecipe()
    recipe.description.insertAt(0, 'Warm and filling')
    recipe.servings = 4
    recipe.prepTime = Duration.create(20, 'minutes')
    recipe.cookTime = Duration.create(1, 'hours')
    recipe.sourceUrl.insertAt(0, 'https://example.com/soup')
    const flour = recipe.ingredients.add()
    flour.name.insertAt(0, 'flour')
    flour.quantity = Quantity.create(1.5, 'cup')
    const eggs = recipe.ingredients.add()
    eggs.name.insertAt(0, 'eggs')
    eggs.quantity = Quantity.create(2, 'none')
    recipe.steps.insertAt(0, 'Simmer gently')
    recipe.tags.add('dinner')
    recipe.notes.add('Sam').text.insertAt(0, 'Tasty')
    return recipe
  }

  it('renders the recipe as a page without editors or controls', () => {
    const recipe = filledRecipe()
    render(<RecipeDetail recipe={recipe} initialMode="view" />)
    expect(document.querySelector('.ql-editor')).toBeNull()
    expect(screen.queryByRole('spinbutton')).toBeNull()
    expect(screen.queryByRole('combobox')).toBeNull()
    expect(screen.queryByRole('button', { name: /add|remove|move/i })).toBeNull()

    expect(screen.getByRole('heading', { level: 2, name: 'Soup' })).toBeInTheDocument()
    expect(screen.getByText('Warm and filling')).toBeInTheDocument()
    expect(screen.getByText(/serves 4/i)).toBeInTheDocument()
    expect(screen.getByText(/prep 20 minutes/i)).toBeInTheDocument()
    expect(screen.getByText(/cook 1 hour\b/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'https://example.com/soup' })).toHaveAttribute(
      'href',
      'https://example.com/soup',
    )
    expect(rows('Ingredients').map((row) => row.textContent)).toEqual(['1.5 cup flour', '2 eggs'])
    expect(screen.getByText('Simmer gently')).toBeInTheDocument()
    expect(within(list('Tags')).getByText('dinner')).toBeInTheDocument()
    const note = rows('Notes')[0]
    expect(note).toHaveTextContent('Sam')
    expect(note).toHaveTextContent('Tasty')
  })

  it('omits sections that have nothing in them', () => {
    const recipe = makeRecipe()
    render(<RecipeDetail recipe={recipe} initialMode="view" />)
    expect(screen.getByRole('heading', { level: 2, name: 'Soup' })).toBeInTheDocument()
    for (const name of [/description/i, /source/i, /ingredients/i, /steps/i, /tags/i, /notes/i]) {
      expect(screen.queryByRole('heading', { name })).toBeNull()
    }
    expect(screen.queryByText(/serves/i)).toBeNull()
    expect(screen.queryByRole('list')).toBeNull()
  })

  it('shows a source that is not a web address as plain text', () => {
    const recipe = makeRecipe()
    recipe.sourceUrl.insertAt(0, "Grandma's card")
    render(<RecipeDetail recipe={recipe} initialMode="view" />)
    expect(screen.getByText("Grandma's card")).toBeInTheDocument()
    expect(screen.queryByRole('link')).toBeNull()
  })

  it('shows a section the moment its empty text gains content', () => {
    const recipe = makeRecipe()
    render(<RecipeDetail recipe={recipe} initialMode="view" />)
    expect(screen.queryByRole('heading', { name: /description/i })).toBeNull()

    act(() => {
      recipe.description.insertAt(0, 'Warm')
    })
    expect(screen.getByRole('heading', { name: /description/i })).toBeInTheDocument()
    expect(screen.getByText('Warm')).toBeInTheDocument()

    act(() => {
      recipe.steps.insertAt(0, 'Simmer')
    })
    expect(screen.getByText('Simmer')).toBeInTheDocument()

    act(() => {
      recipe.sourceUrl.insertAt(0, 'https://example.com')
    })
    expect(screen.getByRole('link', { name: 'https://example.com' })).toBeInTheDocument()

    act(() => {
      recipe.description.removeRange(0, 4)
    })
    expect(screen.queryByRole('heading', { name: /description/i })).toBeNull()
  })
})
