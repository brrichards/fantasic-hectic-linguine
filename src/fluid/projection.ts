import { Tree, TreeStatus } from 'fluid-framework'
import { RecipeCard, type Recipe } from './schema'

export interface RecipeProjection {
  title: string
  tags: string[]
  authorId: string
}

/** The searchable fields of a recipe, as plain strings suitable for its card. */
export function projectRecipe(recipe: Recipe): RecipeProjection {
  return {
    title: recipe.title
      .fullString()
      .replace(/\s*\n\s*/g, ' ')
      .trim(),
    tags: recipe.tags.map((tag) => tag.fullString().trim()).filter((tag) => tag !== ''),
    authorId: recipe.authorId,
  }
}

/** A new card for `recipe`, held in the container `id`. */
export function cardFor(id: string, recipe: Recipe): RecipeCard {
  const { title, tags, authorId } = projectRecipe(recipe)
  return new RecipeCard({ id, title, tags: Object.fromEntries(tags.map((tag) => [tag, true])), authorId })
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
  if (
    card.title === next.title &&
    card.authorId === next.authorId &&
    stale.length === 0 &&
    missing.length === 0
  ) {
    return false
  }
  Tree.runTransaction(card, () => {
    card.title = next.title
    card.authorId = next.authorId
    // Per-key edits merge cleanly when another client makes the same change.
    for (const tag of stale) card.tags.delete(tag)
    for (const tag of missing) card.tags.set(tag, true)
  })
  return true
}

/**
 * Keeps every card in `cards` in step with `recipe` while the recipe is
 * open; the same recipe can have a card in several books, so `cards` is
 * asked for the current set at each write. Returns a function that stops
 * watching.
 */
export function watchRecipeProjection(recipe: Recipe, cards: () => readonly RecipeCard[]): () => void {
  const sync = () => {
    for (const card of cards()) syncCard(card, recipe)
  }
  const unsubscribes = [Tree.on(recipe.title, 'treeChanged', sync), Tree.on(recipe.tags, 'treeChanged', sync)]
  return () => {
    for (const off of unsubscribes) off()
  }
}
