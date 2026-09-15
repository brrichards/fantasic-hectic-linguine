// Live multi-client sync check against a running tinylicious (7070) and Vite
// dev server (5173). Run with: node e2e/sync-check.mjs [--headed]
// All tabs share one browser context, so the two dummy profiles (Alice and
// Bob) are the same two books everywhere; each tab picks who it is. Nothing is
// shared through the URL: books are visited by pasting their id.
import { chromium } from 'playwright'

const headed = process.argv.includes('--headed')
const BASE = 'http://localhost:5173'

/** Waits until the nth Quill editor matching `selector` shows exactly `text`. */
const waitForEditorText = (page, selector, nth, text) =>
  page.waitForFunction(
    ({ selector, nth, text }) =>
      document.querySelectorAll(selector)[nth]?.textContent === text,
    { selector, nth, text },
  )

/** The card button whose title is exactly `title`; tags on the card do not count. */
const recipeButton = (page, title) =>
  page
    .locator('.recipe-list-title')
    .filter({ has: page.locator('.card-title', { hasText: new RegExp(`^${title}$`) }) })
const waitForDetail = (page) =>
  page.getByRole('list', { name: 'Ingredients' }).waitFor({ state: 'attached' })
const titleEditor = '.recipe-detail .rich-text-line .ql-editor'
const ingredientEditors = '[aria-label="Ingredients"] li .ql-editor'
const stepEditors = '.steps .ql-editor'
const profilePicker = (page) => page.getByRole('combobox', { name: 'You are' })
const currentProfile = (page) => profilePicker(page).evaluate((el) => el.selectedOptions[0].textContent)
const bookIdField = (page) => page.getByRole('textbox', { name: 'Book id', exact: true })

/** Selects a profile in the header and waits for the page to come back as that profile. */
const becomeProfile = async (page, name) => {
  await profilePicker(page).selectOption({ label: name })
  await page.waitForFunction((n) => {
    const picker = document.querySelector('select[aria-label="You are"]')
    return picker && picker.selectedOptions[0]?.textContent === n
  }, name)
  await page.getByText('You are viewing', { exact: false }).waitFor({ state: 'detached' })
}

/** Pastes a book id into the header and waits for that book to be on screen. */
const visitBook = async (page, bookId, ownerName) => {
  await page.getByRole('textbox', { name: 'Book id to visit' }).fill(bookId)
  await page.getByRole('button', { name: 'Visit book' }).click()
  await page.getByText(`You are viewing ${ownerName}'s book.`).waitFor()
}

const browser = await chromium.launch({ headless: !headed, slowMo: headed ? 300 : 0 })
const context = await browser.newContext()
const newTab = async (name) => {
  const page = await context.newPage()
  page.on('console', (m) => console.log(`[${name}:${m.type()}]`, m.text()))
  return page
}

try {
  const alice = await newTab('alice')
  await alice.goto(BASE)
  await profilePicker(alice).waitFor()
  if ((await currentProfile(alice)) !== 'Alice') throw new Error('first tab should be Alice')
  if (alice.url() !== `${BASE}/`) throw new Error(`URL should carry nothing, got ${alice.url()}`)
  const aliceBookId = await bookIdField(alice).inputValue()
  if (aliceBookId.length !== 22) throw new Error(`book id should be compact, got ${aliceBookId}`)
  console.log('Alice opened her book; her shareable id is', aliceBookId)

  await alice.getByLabel('New recipe title').fill('Soup')
  await alice.getByRole('button', { name: 'Add recipe' }).click()
  await waitForDetail(alice)
  if (alice.url() !== `${BASE}/`) throw new Error('opening a recipe must not touch the URL')
  console.log('Alice added "Soup"')

  await alice.locator(titleEditor).first().click()
  await alice.keyboard.press('End')
  await alice.keyboard.type(' of the day')
  await recipeButton(alice, 'Soup of the day').waitFor()
  console.log('Alice retitled it in Quill and her card followed')

  await alice.reload()
  await waitForDetail(alice)
  await waitForEditorText(alice, titleEditor, 0, 'Soup of the day')
  console.log("Alice refreshed and landed back on the recipe she had open")

  const bob = await newTab('bob')
  await bob.goto(BASE)
  await profilePicker(bob).waitFor()
  await becomeProfile(bob, 'Bob')
  await bob.getByText('No recipes yet.').waitFor()
  console.log("Bob's tab switched to Bob and his book is empty")

  await visitBook(bob, aliceBookId, 'Alice')
  await recipeButton(bob, 'Soup of the day').waitFor()
  if ((await currentProfile(bob)) !== 'Bob') throw new Error('visiting must not change who you are')
  console.log("Bob visited Alice's book by her id, still as Bob, and sees her recipe")

  await recipeButton(bob, 'Soup of the day').click()
  await waitForDetail(bob)
  await bob.getByRole('button', { name: 'Add ingredient' }).click()
  await bob.locator(ingredientEditors).nth(0).click()
  await bob.keyboard.type('carrots')
  await waitForEditorText(alice, ingredientEditors, 0, 'carrots')
  console.log('Bob added an ingredient in the shared recipe and Alice sees it')

  await alice.locator('.recipe-detail .rich-text-prose .ql-editor').first().click()
  await alice.keyboard.type('Warm')
  await alice.keyboard.press('Shift+Home')
  await alice.keyboard.press('ControlOrMeta+b')
  const boldWarm = () =>
    document.querySelector('.recipe-detail .rich-text-prose .ql-editor strong')?.textContent === 'Warm'
  await alice.waitForFunction(boldWarm)
  await bob.waitForFunction(boldWarm)
  console.log('Bob sees bold "Warm" in the description')

  await bob.getByRole('article').getByRole('button', { name: 'Save to my book' }).click()
  await bob.getByRole('article').getByRole('button', { name: 'Saved' }).waitFor()
  await bob.getByRole('button', { name: 'Back to my book' }).click()
  await bob.getByText('You are viewing', { exact: false }).waitFor({ state: 'detached' })
  await recipeButton(bob, 'Soup of the day').waitFor()
  await bob.getByRole('button', { name: "from Alice's book" }).waitFor()
  console.log("Bob saved the recipe into his book; the card says it is from Alice's book")

  await recipeButton(bob, 'Soup of the day').click()
  await waitForDetail(bob)
  await bob.locator(stepEditors).nth(0).click()
  await bob.keyboard.type('Simmer')
  await waitForEditorText(alice, stepEditors, 0, 'Simmer')
  console.log('Bob edited the saved recipe from his book and Alice sees the step')

  await alice.getByLabel('New tag').fill('dinner')
  await alice.getByRole('button', { name: 'Add tag' }).click()
  await bob.locator('.recipe-list .card-tag', { hasText: 'dinner' }).waitFor()
  console.log("Alice added a tag and Bob's saved card picked it up")

  await bob.getByRole('button', { name: "from Alice's book" }).click()
  await bob.getByText("You are viewing Alice's book.").waitFor()
  console.log("Bob followed the card's origin back to Alice's book")

  const fresh = await newTab('fresh')
  await fresh.goto(BASE)
  await profilePicker(fresh).waitFor()
  if ((await currentProfile(fresh)) !== 'Bob') throw new Error('a new tab should open as the last chosen profile')
  await recipeButton(fresh, 'Soup of the day').waitFor()
  console.log('A new tab opened as Bob, the last profile chosen, on his own book')

  const bad = await newTab('bad')
  await bad.goto(BASE)
  await profilePicker(bad).waitFor()
  await bad.getByRole('textbox', { name: 'Book id to visit' }).fill('AAAAAAAAAAAAAAAAAAAAAA')
  await bad.getByRole('button', { name: 'Visit book' }).click()
  await bad.getByText('Could not join session').waitFor({ timeout: 15000 })
  await bad.getByRole('button', { name: 'Back to my book' }).click()
  await profilePicker(bad).waitFor()
  console.log('Visiting a bad book id showed the error screen and recovered to the home book')

  console.log('SYNC CHECK PASSED')
} finally {
  await browser.close()
}
