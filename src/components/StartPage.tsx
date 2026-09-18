import { useState, type FormEvent } from 'react'
import '../App.css'
import { bookIdFromInput, shareableId } from '../ids'
import type { Profile } from '../profiles'

interface StartPageProps {
  /** Books this browser has signed in to before. */
  remembered: Profile[]
  /** Why the last attempt to open or create a book failed. */
  error?: string
  /** A book is being opened or created; no further requests are taken. */
  busy?: boolean
  onOpen: (bookId: string) => void
  onCreate: (name: string) => void
  onForget: (bookId: string) => void
}

/**
 * Where a tab signs in: to a book by its id, or to a new book with a name.
 * Nothing here talks to the Fluid service; that starts once a book is chosen.
 */
export function StartPage({ remembered, error, busy = false, onOpen, onCreate, onForget }: StartPageProps) {
  const [idInput, setIdInput] = useState('')
  const [nameInput, setNameInput] = useState('')

  const submitOpen = (event: FormEvent) => {
    event.preventDefault()
    const id = bookIdFromInput(idInput)
    if (busy || !id) return
    onOpen(id)
  }

  const submitCreate = (event: FormEvent) => {
    event.preventDefault()
    const name = nameInput.trim()
    if (busy || !name) return
    onCreate(name)
  }

  return (
    <main className="start-page">
      <h1>Recipe book</h1>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {remembered.length > 0 && (
        <section>
          <h2>Books on this device</h2>
          <ul className="remembered-books">
            {remembered.map((profile) => (
              <li key={profile.bookId}>
                <button type="button" disabled={busy} onClick={() => onOpen(profile.bookId)}>
                  {profile.name}
                </button>
                <span className="muted">{shareableId(profile.bookId)}</span>
                <button
                  type="button"
                  className="link-button"
                  aria-label={`Forget ${profile.name}`}
                  disabled={busy}
                  onClick={() => onForget(profile.bookId)}
                >
                  Forget
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section>
        <h2>Open a book</h2>
        <form onSubmit={submitOpen} className="inline-form">
          <input
            aria-label="Book id"
            placeholder="Paste a book id"
            value={idInput}
            onChange={(event) => setIdInput(event.target.value)}
          />
          <button type="submit" disabled={busy}>
            Open
          </button>
        </form>
      </section>
      <section>
        <h2>Create a book</h2>
        <form onSubmit={submitCreate} className="inline-form">
          <input
            aria-label="Book name"
            placeholder="Name your book"
            value={nameInput}
            onChange={(event) => setNameInput(event.target.value)}
          />
          <button type="submit" disabled={busy}>
            Create
          </button>
        </form>
      </section>
    </main>
  )
}
