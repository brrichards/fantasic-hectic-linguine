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
    containerId: `container-${title}`,
    title,
    tags: {},
    updatedAt: 1,
    ...overrides,
  })
}

const noop = () => {}

function renderList(
  cards: RecipeCards,
  props: Partial<Parameters<typeof RecipeList>[0]> = {},
) {
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
  it('lists card titles', () => {
    const cards = makeCards()
    cards.add(card('Soup'))
    cards.add(card('Bread'))
    renderList(cards)
    expect(screen.getByRole('button', { name: 'Soup' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Bread' })).toBeInTheDocument()
  })

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

  it('reports the card id when a title is clicked', () => {
    const cards = makeCards()
    const soup = cards.add(card('Soup'))
    const onSelect = vi.fn()
    renderList(cards, { onSelect })
    fireEvent.click(screen.getByRole('button', { name: 'Soup' }))
    expect(onSelect).toHaveBeenCalledWith(soup.id)
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
    cards.add(card('Soup', { originBookId: 'theirs' }))
    cards.add(card('Bread', { originBookId: 'home' }))
    cards.add(card('Rice'))
    const onVisitBook = vi.fn()
    renderList(cards, { onVisitBook })
    const items = screen.getAllByRole('listitem')
    fireEvent.click(within(items[0]).getByRole('button', { name: /from another book/i }))
    expect(onVisitBook).toHaveBeenCalledWith('theirs')
    expect(within(items[1]).queryByRole('button', { name: /from/i })).toBeNull()
    expect(within(items[2]).queryByRole('button', { name: /from/i })).toBeNull()
  })

  it('names the book a card came from when a name is known', () => {
    const cards = makeCards()
    cards.add(card('Soup', { originBookId: 'theirs' }))
    cards.add(card('Rice', { originBookId: 'unknown' }))
    renderList(cards, { nameOfBook: (id) => (id === 'theirs' ? 'Bob' : undefined), onVisitBook: () => {} })
    const items = screen.getAllByRole('listitem')
    expect(within(items[0]).getByRole('button', { name: "from Bob's book" })).toBeInTheDocument()
    expect(within(items[1]).getByRole('button', { name: 'from another book' })).toBeInTheDocument()
  })

  it('offers to save each card when saving is enabled', () => {
    const cards = makeCards()
    const soup = cards.add(card('Soup'))
    const bread = cards.add(card('Bread'))
    const onSave = vi.fn()
    renderList(cards, { saving: { isSaved: (id) => id === bread.id, onSave } })
    const items = screen.getAllByRole('listitem')
    fireEvent.click(within(items[0]).getByRole('button', { name: /save to my book/i }))
    expect(onSave).toHaveBeenCalledWith(soup.id)
    expect(within(items[1]).getByRole('button', { name: /saved/i })).toBeDisabled()
  })

  it('shows no save buttons when saving is not enabled', () => {
    const cards = makeCards()
    cards.add(card('Soup'))
    renderList(cards)
    expect(screen.queryByRole('button', { name: /save/i })).toBeNull()
  })
})
