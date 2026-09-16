/**
 * A profile is a name and its book's container id; the book id is the
 * profile's identity. This module keeps the profiles known on this device,
 * the way a browser keeps a list of accounts, and which one each tab is
 * signed in as. A real sign-in would hand the app a book id the same way.
 */
export interface Profile {
  name: string
  bookId: string
}

const KNOWN_KEY = 'fhl.recipes.profiles'
/** Per tab: which profile this tab is signed in as. */
const ACTIVE_KEY = 'fhl.recipes.activeBook'
/** Per browser: the profile chosen most recently in any tab; new tabs start as it. */
const LAST_KEY = 'fhl.recipes.lastBook'
const DUMMY_NAMES = ['Alice', 'Bob']

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

/** Adds a profile unless a profile for that book is already known. */
export function addProfile(profile: Profile): void {
  const known = readKnown()
  if (known.some((p) => p.bookId === profile.bookId)) return
  writeKnown([...known, profile])
}

export function profileForBook(bookId: string): Profile | undefined {
  return readKnown().find((p) => p.bookId === bookId)
}

function readChoice(storage: Storage, key: string): string | undefined {
  try {
    return storage.getItem(key) ?? undefined
  } catch {
    return undefined
  }
}

/**
 * The book this tab is signed in to: this tab's own choice, else the profile
 * chosen most recently anywhere in the browser, else the first known one.
 * Choices that no longer match a known profile are ignored.
 */
export function getActiveBookId(): string | undefined {
  const known = readKnown()
  const isKnown = (id: string | undefined): id is string =>
    id !== undefined && known.some((p) => p.bookId === id)
  const own = readChoice(sessionStorage, ACTIVE_KEY)
  if (isKnown(own)) return own
  const last = readChoice(localStorage, LAST_KEY)
  if (isKnown(last)) return last
  return known[0]?.bookId
}

export function setActiveBookId(bookId: string): void {
  try {
    sessionStorage.setItem(ACTIVE_KEY, bookId)
    localStorage.setItem(LAST_KEY, bookId)
  } catch {
    // Storage may be blocked; the app still works for this page load.
  }
}

/** Forgets every known profile and the active choice. */
export function resetProfiles(): void {
  try {
    localStorage.removeItem(KNOWN_KEY)
    localStorage.removeItem(LAST_KEY)
    sessionStorage.removeItem(ACTIVE_KEY)
  } catch {
    // Storage may be blocked.
  }
}

/**
 * Makes sure the two dummy profiles exist, creating a book for each missing
 * one with `createBook`. Returns every known profile.
 */
export async function ensureDummyProfiles(createBook: () => Promise<string>): Promise<Profile[]> {
  for (const name of DUMMY_NAMES) {
    if (readKnown().some((p) => p.name === name)) continue
    addProfile({ name, bookId: await createBook() })
  }
  return readKnown()
}
