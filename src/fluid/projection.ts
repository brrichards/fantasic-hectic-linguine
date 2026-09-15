import { Tree, TreeStatus } from 'fluid-framework'
import type { Recipe, RecipeCard } from './schema'

export interface RecipeProjection {
  title: string
  tags: string[]
}

/** The searchable fields of a recipe, as plain strings suitable for its card. */
export function projectRecipe(recipe: Recipe): RecipeProjection {
  return {
    title: recipe.title.fullString().replace(/\s*\n\s*/g, ' ').trim(),
    tags: recipe.tags.map((tag) => tag.fullString().trim()).filter((tag) => tag !== ''),
  }
}

/**
 * Copies the recipe's projection onto its card in one commit. Returns
 * whether anything was written. Does nothing when the card is no longer
 * part of a book or already matches.
 */
export function syncCard(card: RecipeCard, recipe: Recipe): boolean {
  if (Tree.status(card) !== TreeStatus.InDocument) return false
  const next = projectRecipe(recipe)
  const wanted = new Set(next.tags)
  const stale = [...card.tags.keys()].filter((tag) => !wanted.has(tag))
  const missing = next.tags.filter((tag) => !card.tags.has(tag))
  if (card.title === next.title && stale.length === 0 && missing.length === 0) return false
  Tree.runTransaction(card, () => {
    card.title = next.title
    // Per-key edits merge cleanly when another client makes the same change.
    for (const tag of stale) card.tags.delete(tag)
    for (const tag of missing) card.tags.set(tag, true)
    card.updatedAt = Date.now()
  })
  return true
}

/**
 * Keeps every card in `cards` in step with `recipe` while the recipe is
 * open; the same recipe can have a card in several books, so `cards` may be
 * a function that is asked for the current set at each write. Title and tag
 * changes are coalesced over `delayMs` before one `syncCard` per card, which
 * also keeps the writes out of the tree's own change callbacks. Returns a
 * function that stops watching and cancels any pending write.
 */
export function watchRecipeProjection(
  recipe: Recipe,
  cards: readonly RecipeCard[] | (() => readonly RecipeCard[]),
  delayMs = 300,
): () => void {
  const currentCards = typeof cards === 'function' ? cards : () => cards
  let timer: ReturnType<typeof setTimeout> | undefined
  const schedule = () => {
    if (timer !== undefined) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = undefined
      for (const card of currentCards()) syncCard(card, recipe)
    }, delayMs)
  }
  const unsubscribes = [
    Tree.on(recipe.title, 'treeChanged', schedule),
    Tree.on(recipe.tags, 'treeChanged', schedule),
  ]
  return () => {
    if (timer !== undefined) clearTimeout(timer)
    timer = undefined
    for (const off of unsubscribes) off()
  }
}
