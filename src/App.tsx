import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import './App.css'
import { CopyLink } from './components/CopyLink'
import { RecipeDetail, type DetailMode } from './components/RecipeDetail'
import { RecipeList, type SaveControls } from './components/RecipeList'
import type { Recipe, RecipeCard } from './fluid/schema'
import type { RecipeSession } from './fluid/session'
import { useNode } from './hooks/useNode'
import { bookIdFromInput, shareableId } from './ids'
import { clearActiveBookId, profileForBook } from './profiles'
import {
  clearSelectedRecipeId,
  clearVisitingBookId,
  getSelectedRecipeId,
  setSelectedRecipeId,
  setVisitingBookId,
} from './tabState'

type Panel =
  | { status: 'idle' }
  | { status: 'opening'; id: string }
  | { status: 'open'; card: RecipeCard; recipe: Recipe; mode: DetailMode }
  | { status: 'error'; id: string; message: string }

interface AppProps {
  session: RecipeSession
  /** Starts the page over, which is how a change of book takes effect. */
  reload?: () => void
}

function App({ session, reload = () => location.reload() }: AppProps) {
  useNode(session.book.cards)
  useNode(session.homeBook.cards)
  const [panel, setPanel] = useState<Panel>({ status: 'idle' })
  const [visitInput, setVisitInput] = useState('')
  // Only the latest open or create request may update the panel.
  const request = useRef(0)
  const bookId = session.bookId

  const showList = useCallback(() => {
    request.current += 1
    session.deselect()
    setPanel({ status: 'idle' })
    clearSelectedRecipeId()
  }, [session])

  const open = useCallback(
    async (id: string) => {
      const card = session.book.cards.findById(id)
      if (!card) {
        showList()
        return
      }
      const mine = ++request.current
      setPanel({ status: 'opening', id })
      try {
        const recipe = await session.select(card)
        if (mine !== request.current) return
        setPanel({ status: 'open', card, recipe, mode: 'view' })
        setSelectedRecipeId(id)
      } catch (err) {
        if (mine !== request.current) return
        setPanel({ status: 'error', id, message: err instanceof Error ? err.message : String(err) })
      }
    },
    [session, showList],
  )

  const create = useCallback(
    async (title: string) => {
      const mine = ++request.current
      setPanel({ status: 'opening', id: '' })
      try {
        const card = await session.createRecipe(title)
        if (mine !== request.current) return
        setPanel({ status: 'open', card, recipe: session.current!.recipe, mode: 'edit' })
        setSelectedRecipeId(card.id)
      } catch (err) {
        if (mine !== request.current) return
        setPanel({ status: 'error', id: '', message: err instanceof Error ? err.message : String(err) })
      }
    },
    [session],
  )

  // Reopen whatever this tab had open before it was refreshed. Opening is
  // asynchronous work against the container, so it starts after this render.
  useEffect(() => {
    const remembered = getSelectedRecipeId()
    if (!remembered) return
    let cancelled = false
    queueMicrotask(() => {
      if (!cancelled) void open(remembered)
    })
    return () => {
      cancelled = true
    }
  }, [open])

  // Another client removed the card we have open: show the list right away
  // and release the container, without waiting for a state round-trip.
  const openCardGone = panel.status === 'open' && session.book.cards.findById(panel.card.id) === undefined
  const shown: Panel = openCardGone ? { status: 'idle' } : panel
  useEffect(() => {
    if (!openCardGone) return
    request.current += 1
    session.deselect()
    clearSelectedRecipeId()
  }, [openCardGone, session])

  const selectedId =
    shown.status === 'open' ? shown.card.id : shown.status === 'opening' ? shown.id : undefined

  const saving: SaveControls | undefined = session.isHome
    ? undefined
    : {
        isSaved: (id) => session.homeHas(id),
        onSave: (id) => {
          const card = session.book.cards.findById(id)
          if (card) session.saveToHome(card)
        },
      }

  /** Any change of book takes effect on a fresh page, since books load once. */
  const signOut = () => {
    clearActiveBookId()
    clearVisitingBookId()
    clearSelectedRecipeId()
    reload()
  }

  const visitBook = (id: string) => {
    if (id === session.homeBookId) return
    setVisitingBookId(id)
    clearSelectedRecipeId()
    reload()
  }

  const goHome = () => {
    clearVisitingBookId()
    clearSelectedRecipeId()
    reload()
  }

  const submitVisit = (event: FormEvent) => {
    event.preventDefault()
    const id = bookIdFromInput(visitInput)
    if (!id) return
    setVisitInput('')
    visitBook(id)
  }

  const nameOfBook = (id: string) => profileForBook(id)?.name
  /** The author is whoever owns the book a recipe was created in. */
  const isAuthor = (card: RecipeCard) => card.authorId === session.homeBookId

  return (
    <main className="app">
      <header className="app-header">
        <div className="book-identity">
          <p className="signed-in">
            <span>Signed in as {session.homeBook.name}</span>
            <button type="button" className="link-button" onClick={signOut}>
              Sign out
            </button>
          </p>
          <CopyLink label="Copy book id" url={shareableId(bookId)} className="book-id-row" />
        </div>
        <form onSubmit={submitVisit} className="inline-form visit-book book-id-row">
          <input
            aria-label="Book id to visit"
            placeholder="Paste a book id to visit"
            value={visitInput}
            onChange={(event) => setVisitInput(event.target.value)}
          />
          <button type="submit">Visit</button>
        </form>
      </header>
      <div>
        {!session.isHome && (
          <p className="book-banner">
            <span>You are viewing {session.book.name}'s book.</span>
            <button type="button" className="link-button" onClick={goHome}>
              Back to my book
            </button>
          </p>
        )}
        <RecipeList
          cards={session.book.cards}
          bookId={bookId}
          selectedId={selectedId}
          onSelect={(id) => void open(id)}
          onCreate={(title) => void create(title)}
          isOwner={session.isHome}
          saving={saving}
          nameOfBook={nameOfBook}
          onVisitBook={visitBook}
        />
      </div>
      {shown.status === 'open' ? (
        <RecipeDetail
          key={shown.card.id}
          recipe={shown.recipe}
          onSave={saving ? () => saving.onSave(shown.card.id) : undefined}
          saved={saving?.isSaved(shown.card.id)}
          initialMode={shown.mode}
          isAuthor={isAuthor(shown.card)}
          userName={session.homeBook.name}
        />
      ) : shown.status === 'opening' ? (
        <p className="muted empty-state">Opening…</p>
      ) : shown.status === 'error' ? (
        <p role="alert" className="empty-state error">
          Could not open this recipe: {shown.message}
        </p>
      ) : (
        <p className="muted empty-state">
          {session.isHome ? 'Select a recipe, or add a new one.' : 'Select a recipe.'}
        </p>
      )}
    </main>
  )
}

export default App
