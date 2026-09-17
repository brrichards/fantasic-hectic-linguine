/**
 * A profile is a name and its book's container id; the book id is the
 * profile's identity, and the name is a copy of the one in the book. This
 * module keeps the books this browser has signed in to, the way a browser
 * keeps a list of accounts, and which one each tab is signed in as.
 */
export interface Profile {
  name: string
  bookId: string
}

const KNOWN_KEY = 'fhl.recipes.profiles'
/** Per tab: which profile this tab is signed in as. */
const ACTIVE_KEY = 'fhl.recipes.activeBook'

function readKnown(): Profile[] {
  try {
    const raw = localStorage.getItem(KNOWN_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (p): p is Profile =>
        typeof p === 'object' && p !== null && typeof p.name === 'string' && typeof p.bookId === 'string',
    )
  } catch {
    return []
  }
}

function writeKnown(profiles: Profile[]): void {
  try {
    localStorage.setItem(KNOWN_KEY, JSON.stringify(profiles))
  } catch {
    // Storage may be blocked; the app still works for this page load.
  }
}

export function getKnownProfiles(): Profile[] {
  return readKnown()
}

/** Remembers a book, or takes the new name for one that is already known. */
export function addProfile(profile: Profile): void {
  const known = readKnown()
  const isKnown = known.some((p) => p.bookId === profile.bookId)
  writeKnown(isKnown ? known.map((p) => (p.bookId === profile.bookId ? profile : p)) : [...known, profile])
}

export function forgetProfile(bookId: string): void {
  writeKnown(readKnown().filter((p) => p.bookId !== bookId))
}

export function profileForBook(bookId: string): Profile | undefined {
  return readKnown().find((p) => p.bookId === bookId)
}

/** The book this tab is signed in to, if it has signed in. */
export function getActiveBookId(): string | undefined {
  try {
    return sessionStorage.getItem(ACTIVE_KEY) ?? undefined
  } catch {
    return undefined
  }
}

export function setActiveBookId(bookId: string): void {
  try {
    sessionStorage.setItem(ACTIVE_KEY, bookId)
  } catch {
    // Storage may be blocked; the app still works for this page load.
  }
}

/** Signs this tab out. */
export function clearActiveBookId(): void {
  try {
    sessionStorage.removeItem(ACTIVE_KEY)
  } catch {
    // Storage may be blocked.
  }
}
