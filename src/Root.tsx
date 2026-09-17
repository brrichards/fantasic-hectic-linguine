import { useEffect, useRef, useState, type ComponentType } from 'react'
import { StartPage } from './components/StartPage'
import type { BookHandle, Connect, FluidService, RecipeSession } from './fluid/session'
import {
  addProfile,
  clearActiveBookId,
  forgetProfile,
  getActiveBookId,
  getKnownProfiles,
  profileForBook,
  setActiveBookId,
} from './profiles'
import { clearSelectedRecipeId, clearVisitingBookId, getVisitingBookId } from './tabState'

interface RootProps {
  connect: Connect
  /** Starts the page over. */
  reloadPage?: () => void
}

type AppComponent = ComponentType<{ session: RecipeSession; reload?: () => void }>

type State =
  | { status: 'start'; busy: boolean; error?: string }
  /** This tab was already signed in, and its book is being opened again. */
  | { status: 'resuming' }
  | { status: 'ready'; App: AppComponent; session: RecipeSession; books: BookHandle[] }
  | { status: 'visitFailed' }

const OPEN_FAILED = 'That recipe book could not be opened (a wrong id, or the Fluid service restarted?).'
const CREATE_FAILED = 'A new recipe book could not be created. Is the Fluid service running?'

/**
 * Signs this tab in to the book that `pick` opens or creates. The app and
 * everything Fluid load here, so the start page costs none of it.
 */
async function signIn(
  connect: Connect,
  userName: string,
  pick: (service: FluidService) => Promise<BookHandle>,
  failure: string,
): Promise<State> {
  let service: FluidService
  let home: BookHandle
  let App: AppComponent
  let Session: typeof RecipeSession
  try {
    const [connected, appModule, sessionModule] = await Promise.all([
      connect(userName),
      import('./App'),
      import('./fluid/session'),
    ])
    service = connected
    App = appModule.default
    Session = sessionModule.RecipeSession
    home = await pick(service)
  } catch (err) {
    console.error(err)
    clearActiveBookId()
    return { status: 'start', busy: false, error: failure }
  }
  setActiveBookId(home.bookId)
  addProfile({ name: home.view.root.name, bookId: home.bookId })

  let browsed: BookHandle | undefined
  const visiting = getVisitingBookId()
  if (visiting && visiting !== home.bookId) {
    try {
      browsed = await service.openBook(visiting)
    } catch (err) {
      console.error(err)
      return { status: 'visitFailed' }
    }
  }
  const books = browsed ? [home, browsed] : [home]
  return { status: 'ready', App, session: new Session({ home, browsed }, service.source), books }
}

/**
 * The page: the start page until this tab has a book, then the app on that
 * book. A tab that is already signed in goes straight to its book.
 */
export function Root({ connect, reloadPage = () => location.reload() }: RootProps) {
  const [state, setState] = useState<State>(() =>
    getActiveBookId() ? { status: 'resuming' } : { status: 'start', busy: false },
  )
  const [remembered, setRemembered] = useState(getKnownProfiles)

  const enter = (userName: string, pick: (service: FluidService) => Promise<BookHandle>, failure: string) => {
    void signIn(connect, userName, pick, failure).then((next) => {
      setRemembered(getKnownProfiles())
      setState(next)
    })
  }
  /** Until the book is open its name is only known if this browser has seen it before. */
  const open = (bookId: string) =>
    enter(profileForBook(bookId)?.name ?? 'anonymous', (service) => service.openBook(bookId), OPEN_FAILED)
  const create = (name: string) => enter(name, (service) => service.createBook(name), CREATE_FAILED)

  // Books load once per page, so an effect that ran twice would open two.
  const resumed = useRef(false)
  useEffect(() => {
    if (resumed.current) return
    resumed.current = true
    const active = getActiveBookId()
    if (active) open(active)
  })

  /** A sign-in from the start page begins at home, whatever this tab did before. */
  const startFresh = () => {
    clearVisitingBookId()
    clearSelectedRecipeId()
    setState({ status: 'start', busy: true })
  }

  if (state.status === 'resuming') {
    return (
      <main>
        <p className="muted">Opening…</p>
      </main>
    )
  }

  if (state.status === 'visitFailed') {
    const goHome = () => {
      clearVisitingBookId()
      reloadPage()
    }
    return (
      <main>
        <h1>Could not open that book</h1>
        <p>
          The recipe book you were visiting could not be opened (a wrong id, or the Fluid service restarted?).
        </p>
        <p>
          <button type="button" onClick={goHome}>
            Back to my book
          </button>
        </p>
      </main>
    )
  }

  if (state.status === 'ready') {
    const { App, session, books } = state
    // Changing book (sign-out, visit, home) happens on a fresh page. Let
    // pending edits be acknowledged first, or a save made just before
    // leaving would be lost.
    const reload = () => {
      void Promise.all(books.map((book) => book.whenSaved?.())).then(reloadPage)
    }
    return <App session={session} reload={reload} />
  }

  return (
    <StartPage
      remembered={remembered}
      error={state.error}
      busy={state.busy}
      onOpen={(bookId) => {
        startFresh()
        open(bookId)
      }}
      onCreate={(name) => {
        startFresh()
        create(name)
      }}
      onForget={(bookId) => {
        forgetProfile(bookId)
        setRemembered(getKnownProfiles())
      }}
    />
  )
}
