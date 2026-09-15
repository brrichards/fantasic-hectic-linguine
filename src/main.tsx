import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { loadBook, tinyliciousSource } from './fluid/client.ts'
import { RecipeSession, type BookHandle } from './fluid/session.ts'
import { ensureDummyProfiles, getActiveBookId, resetProfiles } from './profiles.ts'
import { clearVisitingBookId, getVisitingBookId } from './tabState.ts'

const root = createRoot(document.getElementById('root')!)

// Location never lives in the URL; drop anything an old link left there.
if (location.hash) history.replaceState(null, '', location.pathname)

try {
  // Until real sign-in exists, two profiles are created on first use.
  const profiles = await ensureDummyProfiles(async () => (await loadBook()).bookId)
  const home = await loadBook(getActiveBookId() ?? profiles[0].bookId)
  let browsed: BookHandle | undefined
  const visiting = getVisitingBookId()
  if (visiting && visiting !== home.bookId) {
    browsed = await loadBook(visiting)
  }
  const session = new RecipeSession({ home, browsed }, tinyliciousSource)
  // Changing book (profile, visit, home) happens on a fresh page, since book
  // containers are loaded once here. Let pending edits be acknowledged first,
  // or a save made just before leaving would be lost.
  const reload = () => {
    const books = [home, browsed].filter((book) => book !== undefined)
    void Promise.all(books.map((book) => book.whenSaved?.())).then(() => location.reload())
  }
  root.render(
    <StrictMode>
      <App session={session} reload={reload} />
    </StrictMode>,
  )
} catch (err) {
  const goHome = () => {
    clearVisitingBookId()
    location.reload()
  }
  const startOver = () => {
    resetProfiles()
    clearVisitingBookId()
    location.reload()
  }
  root.render(
    <StrictMode>
      <main>
        <h1>Could not join session</h1>
        <p>That recipe book could not be opened (a wrong id, or tinylicious restarted?).</p>
        <p>
          <button type="button" onClick={goHome}>
            Back to my book
          </button>
        </p>
        <p>
          <button type="button" onClick={startOver}>
            Reset profiles and start over
          </button>
        </p>
      </main>
    </StrictMode>,
  )
  throw err
}
