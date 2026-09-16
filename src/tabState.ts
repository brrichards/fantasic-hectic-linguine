/**
 * Where this tab is: which book it is visiting, if any, and which recipe it
 * has open. Kept in session storage so a refresh lands in the same place and
 * other tabs are unaffected. Nothing about location lives in the URL.
 */
const VISITING_KEY = 'fhl.recipes.visitingBook'
const SELECTED_KEY = 'fhl.recipes.selectedRecipe'

function read(key: string): string | undefined {
  try {
    return sessionStorage.getItem(key) ?? undefined
  } catch {
    return undefined
  }
}

function write(key: string, value: string | undefined): void {
  try {
    if (value === undefined) sessionStorage.removeItem(key)
    else sessionStorage.setItem(key, value)
  } catch {
    // Storage may be blocked; the app still works for this page load.
  }
}

export const getVisitingBookId = () => read(VISITING_KEY)
export const setVisitingBookId = (bookId: string) => write(VISITING_KEY, bookId)
export const clearVisitingBookId = () => write(VISITING_KEY, undefined)

export const getSelectedRecipeId = () => read(SELECTED_KEY)
export const setSelectedRecipeId = (recipeId: string) => write(SELECTED_KEY, recipeId)
export const clearSelectedRecipeId = () => write(SELECTED_KEY, undefined)
