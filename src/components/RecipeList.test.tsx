import { fireEvent, render, screen, within } from '@testing-library/react'
import { act } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { RecipeCard, type RecipeCards } from '../fluid/schema'
import { makeBookView } from '../test/fakeContainerSource'
import { RecipeList } from './RecipeList'

function makeCards() {
  return makeBookView().root.cards
}

function card(title: string, overrides: Partial<ConstructorParameters<typeof RecipeCard>[0]> = {}) {
  return new RecipeCard({
    id: `container-${title}`,
    title,
    tags: {},
    authorId: 'home',
    ...overrides,
  })
}

const noop = () => {}

function renderList(cards: RecipeCards, props: Partial<Parameters<typeof RecipeList>[0]> = {}) {
  return render(
    <RecipeList
      cards={cards}
      bookId="home"
      selectedId={undefined}
      onSelect={noop}
      onCreate={noop}
      {...props}
    />,
  )
}

describe('RecipeList', () => {
  it('shows a card’s tags', () => {
    const cards = makeCards()
    cards.add(card('Soup', { tags: { dinner: true, vegan: true } }))
    renderList(cards)
    expect(screen.getByText('dinner')).toBeInTheDocument()
    expect(screen.getByText('vegan')).toBeInTheDocument()
  })

  it('says so when there are no recipes', () => {
    renderList(makeCards())
    expect(screen.getByText(/no recipes yet/i)).toBeInTheDocument()
  })

  it('marks the selected card', () => {
    const cards = makeCards()
    const soup = cards.add(card('Soup'))
    cards.add(card('Bread'))
    renderList(cards, { selectedId: soup.id })
    expect(screen.getByRole('button', { name: 'Soup' })).toHaveAttribute('aria-current', 'true')
    expect(screen.getByRole('button', { name: 'Bread' })).not.toHaveAttribute('aria-current')
  })

  it('asks for a new recipe from the form and clears the input', () => {
    const onCreate = vi.fn()
    renderList(makeCards(), { onCreate })
    const input = screen.getByRole('textbox', { name: /new recipe/i })
    fireEvent.change(input, { target: { value: '  Pancakes ' } })
    fireEvent.click(screen.getByRole('button', { name: /add recipe/i }))
    expect(onCreate).toHaveBeenCalledWith('Pancakes')
    expect(input).toHaveValue('')
  })

  it('does not ask for a recipe with a blank title', () => {
    const onCreate = vi.fn()
    renderList(makeCards(), { onCreate })
    fireEvent.click(screen.getByRole('button', { name: /add recipe/i }))
    expect(onCreate).not.toHaveBeenCalled()
  })

  it('removes a card from the book', () => {
    const cards = makeCards()
    cards.add(card('Soup'))
    renderList(cards)
    fireEvent.click(screen.getByRole('button', { name: /remove soup/i }))
    expect(cards.length).toBe(0)
    expect(screen.queryByRole('button', { name: 'Soup' })).not.toBeInTheDocument()
  })

  it('re-renders when cards are added or retitled outside the component', () => {
    const cards = makeCards()
    renderList(cards)
    act(() => {
      cards.add(card('Soup'))
    })
    expect(screen.getByRole('button', { name: 'Soup' })).toBeInTheDocument()
    act(() => {
      cards[0].title = 'Hot Soup'
    })
    expect(screen.getByRole('button', { name: 'Hot Soup' })).toBeInTheDocument()
  })

  it('offers to visit the book a card came from when that is a different book', () => {
    const cards = makeCards()
    cards.add(card('Soup', { authorId: 'theirs' }))
    cards.add(card('Bread', { authorId: 'home' }))
    const onVisitBook = vi.fn()
    renderList(cards, { onVisitBook })
    const items = screen.getAllByRole('listitem')
    fireEvent.click(within(items[0]).getByRole('button', { name: /from another book/i }))
    expect(onVisitBook).toHaveBeenCalledWith('theirs')
    expect(within(items[1]).queryByRole('button', { name: /from/i })).toBeNull()
  })

  it('shows no save buttons when saving is not enabled', () => {
    const cards = makeCards()
    cards.add(card('Soup'))
    renderList(cards)
    expect(screen.queryByRole('button', { name: /save/i })).toBeNull()
  })
})
