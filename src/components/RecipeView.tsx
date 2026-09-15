import type { ReactNode } from 'react'
import type { Ingredient, Recipe, RichText } from '../fluid/schema'
import { useNode } from '../hooks/useNode'
import { RichTextView } from '../text/RichTextView'

interface RecipeViewProps {
  recipe: Recipe
  /** Rendered beside the title, e.g. the save button. */
  titleControls?: ReactNode
}


/** "1 hour", "20 minutes": the stored unit, singular when the value is one. */
function durationText({ value, unit }: { value: number; unit: string }): string {
  return `${value} ${value === 1 ? unit.replace(/s$/, '') : unit}`
}

function quantityText({ value, unit }: { value: number; unit: string }): string {
  return unit === 'none' ? String(value) : `${value} ${unit}`
}

function isWebAddress(text: string): boolean {
  try {
    const url = new URL(text)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

/** The read-only rendering of a recipe: only sections with content are shown. */
export function RecipeView({ recipe, titleControls }: RecipeViewProps) {
  useNode(recipe)
  useNode(recipe.ingredients)
  useNode(recipe.tags)
  useNode(recipe.notes)

  const summary = [
    recipe.servings !== undefined ? `Serves ${recipe.servings}` : undefined,
    recipe.prepTime ? `Prep ${durationText(recipe.prepTime)}` : undefined,
    recipe.cookTime ? `Cook ${durationText(recipe.cookTime)}` : undefined,
  ].filter((part) => part !== undefined)

  return (
    <div className="recipe-view">
      <div className="title-row">
        <h2 className="recipe-view-title">
          <RichTextView node={recipe.title} inline />
        </h2>
        {titleControls}
      </div>

      {summary.length > 0 && <p className="recipe-summary">{summary.join(' · ')}</p>}

      <TextSection title="Description" node={recipe.description} />

      <SourceSection node={recipe.sourceUrl} />

      {recipe.ingredients.length > 0 && (
        <section>
          <h3>Ingredients</h3>
          <ul aria-label="Ingredients" className="ingredient-list">
            {recipe.ingredients.map((ingredient) => (
              <IngredientLine key={ingredient.id} ingredient={ingredient} />
            ))}
          </ul>
        </section>
      )}

      <TextSection title="Steps" node={recipe.steps} className="steps" />

      {recipe.tags.length > 0 && (
        <section>
          <h3>Tags</h3>
          <ul aria-label="Tags" className="plain-list card-tags">
            {recipe.tags.map((tag, index) => (
              <li key={index} className="card-tag">
                <RichTextView node={tag} inline />
              </li>
            ))}
          </ul>
        </section>
      )}

      {recipe.notes.length > 0 && (
        <section>
          <h3>Notes</h3>
          <ul aria-label="Notes" className="plain-list">
            {recipe.notes.map((note) => (
              <li key={note.id} className="note-view">
                <div className="note-header">
                  <strong>
                    <RichTextView node={note.author} inline />
                  </strong>
                  <time dateTime={new Date(note.createdAt).toISOString()}>
                    {new Date(note.createdAt).toLocaleString()}
                  </time>
                </div>
                <RichTextView node={note.text} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

/** A rich text section that is present only while its text has content. */
function TextSection({ title, node, className }: { title: string; node: RichText; className?: string }) {
  useNode(node, 'treeChanged')
  if (node.fullString().trim() === '') return null
  return (
    <section className={className}>
      <h3>{title}</h3>
      <RichTextView node={node} />
    </section>
  )
}

function SourceSection({ node }: { node: RichText }) {
  useNode(node, 'treeChanged')
  const source = node.fullString().trim()
  if (source === '') return null
  return (
    <section>
      <h3>Source</h3>
      {isWebAddress(source) ? (
        <a href={source} target="_blank" rel="noreferrer">
          {source}
        </a>
      ) : (
        <p>{source}</p>
      )}
    </section>
  )
}

function IngredientLine({ ingredient }: { ingredient: Ingredient }) {
  useNode(ingredient)
  return (
    <li>
      {ingredient.quantity && <span className="ingredient-quantity">{quantityText(ingredient.quantity)} </span>}
      <RichTextView node={ingredient.name} inline />
    </li>
  )
}
