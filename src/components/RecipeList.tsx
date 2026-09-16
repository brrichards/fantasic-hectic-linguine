import { useState, type FormEvent } from 'react'
import type { RecipeCard, RecipeCards } from '../fluid/schema'
import { useNode } from '../hooks/useNode'

/** Enables "Save to my book" on each card while browsing another book. */
export interface SaveControls {
  isSaved: (cardId: string) => boolean
  onSave: (cardId: string) => void
}

interface RecipeListProps {
  cards: RecipeCards
  /** The book these cards belong to, so cards from elsewhere can say so. */
  bookId: string
  selectedId: string | undefined
  onSelect: (id: string) => void
  onCreate: (title: string) => void
  saving?: SaveControls
  /** Resolves a book id to its owner's name, when known. */
  nameOfBook?: (bookId: string) => string | undefined
  /** Visits the book a saved card came from. */
  onVisitBook?: (bookId: string) => void
}

export function RecipeList({
  cards,
  bookId,
  selectedId,
  onSelect,
  onCreate,
  saving,
  nameOfBook,
  onVisitBook,
}: RecipeListProps) {
  useNode(cards)
  const [draftTitle, setDraftTitle] = useState('')

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const title = draftTitle.trim()
    if (!title) return
    setDraftTitle('')
    onCreate(title)
  }

  return (
    <aside className="recipe-list">
      <h2>Recipes</h2>
      <form onSubmit={submit} className="inline-form">
        <input
          aria-label="New recipe title"
          placeholder="New recipe title"
          value={draftTitle}
          onChange={(event) => setDraftTitle(event.target.value)}
        />
        <button type="submit">Add recipe</button>
      </form>
      {cards.length === 0 ? (
        <p className="muted recipe-list-empty">No recipes yet.</p>
      ) : (
        <ul className="plain-list">
          {cards.map((card) => (
            <RecipeCardItem
              key={card.id}
              card={card}
              bookId={bookId}
              selected={card.id === selectedId}
              onSelect={onSelect}
              onRemove={() => cards.removeById(card.id)}
              saving={saving}
              nameOfBook={nameOfBook}
              onVisitBook={onVisitBook}
            />
          ))}
        </ul>
      )}
    </aside>
  )
}

interface RecipeCardItemProps {
  card: RecipeCard
  bookId: string
  selected: boolean
  onSelect: (id: string) => void
  onRemove: () => void
  saving?: SaveControls
  nameOfBook?: (bookId: string) => string | undefined
  onVisitBook?: (bookId: string) => void
}

const originName = (name: string | undefined) => (name ? `from ${name}'s book` : 'from another book')

function RecipeCardItem({
  card,
  bookId,
  selected,
  onSelect,
  onRemove,
  saving,
  nameOfBook,
  onVisitBook,
}: RecipeCardItemProps) {
  useNode(card)
  useNode(card.tags)
  const fromElsewhere = card.authorId !== bookId
  const saved = saving?.isSaved(card.id) ?? false
  return (
    <li className="recipe-list-item">
      <button
        type="button"
        className="recipe-list-title"
        aria-current={selected ? 'true' : undefined}
        onClick={() => onSelect(card.id)}
      >
        <span className="card-title">{card.title}</span>
        {card.tags.size > 0 && (
          <span className="card-tags">
            {[...card.tags.keys()].sort().map((tag) => (
              <span key={tag} className="card-tag">
                {tag}
              </span>
            ))}
          </span>
        )}
      </button>
      {fromElsewhere && (
        <button
          type="button"
          className="link-button card-origin"
          onClick={() => onVisitBook?.(card.authorId)}
        >
          {originName(nameOfBook?.(card.authorId))}
        </button>
      )}
      {saving && (
        <button type="button" className="save-button" disabled={saved} onClick={() => saving.onSave(card.id)}>
          {saved ? 'Saved' : 'Save to my book'}
        </button>
      )}
      <button type="button" className="icon-button" aria-label={`Remove ${card.title}`} onClick={onRemove}>
        ×
      </button>
    </li>
  )
}
