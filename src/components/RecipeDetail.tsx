import { useState, type FormEvent } from 'react'
import {
  visibilities,
  type Ingredient,
  type Note,
  type Recipe,
  type RecipeCard,
  type RichText,
  type Step,
  type Visibility,
} from '../fluid/schema'
import { useNode } from '../hooks/useNode'
import { RichTextEditor } from '../text/RichTextEditor'

interface RecipeDetailProps {
  recipe: Recipe
  /** The recipe's card in the book; holds the sharing settings. */
  card: RecipeCard
  /** When given, offers to save this recipe into the user's own book. */
  onSave?: () => void
  saved?: boolean
}

export function RecipeDetail({ recipe, card, onSave, saved = false }: RecipeDetailProps) {
  useNode(recipe)
  useNode(recipe.ingredients)
  useNode(recipe.steps)
  useNode(recipe.tags)
  useNode(recipe.notes)
  useNode(card)

  return (
    <article className="recipe-detail">
      <section className="title-row">
        <div>
          <h3>Title</h3>
          <RichTextEditor node={recipe.title} variant="line" placeholder="Recipe title" />
        </div>
        <label className="number-field">
          Visibility
          <select
            value={card.visibility}
            onChange={(event) => (card.visibility = event.target.value as Visibility)}
          >
            {visibilities.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        {onSave && (
          <button type="button" className="save-button" disabled={saved} onClick={onSave}>
            {saved ? 'Saved' : 'Save to my book'}
          </button>
        )}
      </section>

      <section>
        <h3>Description</h3>
        <RichTextEditor node={recipe.description} variant="prose" placeholder="What is this dish?" />
      </section>

      <section className="number-fields">
        <NumberField label="Servings" value={recipe.servings} onChange={(v) => (recipe.servings = v)} />
        <NumberField
          label="Prep minutes"
          value={recipe.prepMinutes}
          onChange={(v) => (recipe.prepMinutes = v)}
        />
        <NumberField
          label="Cook minutes"
          value={recipe.cookMinutes}
          onChange={(v) => (recipe.cookMinutes = v)}
        />
      </section>

      <section>
        <h3>Source</h3>
        <RichTextEditor node={recipe.sourceUrl} variant="line" placeholder="https://" />
      </section>

      <section>
        <h3>Ingredients</h3>
        <ul aria-label="Ingredients" className="plain-list">
          {recipe.ingredients.map((ingredient, index) => (
            <IngredientRow
              key={ingredient.id}
              ingredient={ingredient}
              controls={<RowControls collection={recipe.ingredients} index={index} label="ingredient" />}
            />
          ))}
        </ul>
        <button type="button" onClick={() => recipe.ingredients.add()}>
          Add ingredient
        </button>
      </section>

      <section>
        <h3>Steps</h3>
        <ol aria-label="Steps" className="plain-list">
          {recipe.steps.map((step, index) => (
            <StepRow
              key={step.id}
              step={step}
              controls={<RowControls collection={recipe.steps} index={index} label="step" />}
            />
          ))}
        </ol>
        <button type="button" onClick={() => recipe.steps.add()}>
          Add step
        </button>
      </section>

      <section>
        <h3>Tags</h3>
        <ul aria-label="Tags" className="plain-list tag-list">
          {recipe.tags.map((tag, index) => (
            <li key={tagKey(tag, index)} className="row">
              <RichTextEditor node={tag} variant="line" />
              <button
                type="button"
                className="icon-button"
                aria-label="Remove tag"
                onClick={() => recipe.tags.removeAt(index)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
        <AddForm label="New tag" button="Add tag" onSubmit={(text) => recipe.tags.add(text)} />
      </section>

      <section>
        <h3>Notes</h3>
        <ul aria-label="Notes" className="plain-list">
          {recipe.notes.map((note, index) => (
            <NoteRow key={note.id} note={note} onRemove={() => recipe.notes.removeAt(index)} />
          ))}
        </ul>
        <AddForm label="Note author" button="Add note" onSubmit={(author) => recipe.notes.add(author)} />
      </section>
    </article>
  )
}

/** Tags are bare RichText nodes with no identifier field, so fall back to position. */
function tagKey(tag: RichText, index: number): string {
  return `${index}:${tag.fullString()}`
}

interface NumberFieldProps {
  label: string
  value: number | undefined
  onChange: (value: number | undefined) => void
}

function NumberField({ label, value, onChange }: NumberFieldProps) {
  return (
    <label className="number-field">
      {label}
      <input
        type="number"
        min={0}
        value={value ?? ''}
        onChange={(event) => {
          const raw = event.target.value
          onChange(raw === '' ? undefined : Number(raw))
        }}
      />
    </label>
  )
}

interface OrderedCollection {
  readonly length: number
  move(from: number, to: number): void
  removeAt(index: number): void
}

function RowControls({
  collection,
  index,
  label,
}: {
  collection: OrderedCollection
  index: number
  label: string
}) {
  return (
    <span className="row-controls">
      <button
        type="button"
        className="icon-button"
        aria-label="Move up"
        disabled={index === 0}
        onClick={() => collection.move(index, index - 1)}
      >
        ↑
      </button>
      <button
        type="button"
        className="icon-button"
        aria-label="Move down"
        disabled={index === collection.length - 1}
        onClick={() => collection.move(index, index + 1)}
      >
        ↓
      </button>
      <button
        type="button"
        className="icon-button"
        aria-label={`Remove ${label}`}
        onClick={() => collection.removeAt(index)}
      >
        ×
      </button>
    </span>
  )
}

function IngredientRow({ ingredient, controls }: { ingredient: Ingredient; controls: React.ReactNode }) {
  useNode(ingredient)
  return (
    <li className="row ingredient-row">
      <label className="number-field">
        Quantity
        <input
          type="number"
          min={0}
          step="any"
          value={ingredient.quantity ?? ''}
          onChange={(event) => {
            const raw = event.target.value
            ingredient.quantity = raw === '' ? undefined : Number(raw)
          }}
        />
      </label>
      <RichTextEditor node={ingredient.unit} variant="line" placeholder="unit" />
      <RichTextEditor node={ingredient.name} variant="line" placeholder="ingredient" />
      <RichTextEditor node={ingredient.note} variant="line" placeholder="note" />
      {controls}
    </li>
  )
}

function StepRow({ step, controls }: { step: Step; controls: React.ReactNode }) {
  return (
    <li className="row step-row">
      <RichTextEditor node={step.text} variant="prose" placeholder="Describe this step" />
      {controls}
    </li>
  )
}

function NoteRow({ note, onRemove }: { note: Note; onRemove: () => void }) {
  return (
    <li className="row note-row">
      <div className="note-header">
        <RichTextEditor node={note.author} variant="line" placeholder="author" />
        <time dateTime={new Date(note.createdAt).toISOString()}>
          {new Date(note.createdAt).toLocaleString()}
        </time>
        <button type="button" className="icon-button" aria-label="Remove note" onClick={onRemove}>
          ×
        </button>
      </div>
      <RichTextEditor node={note.text} variant="prose" placeholder="Write a note" />
    </li>
  )
}

function AddForm({
  label,
  button,
  onSubmit,
}: {
  label: string
  button: string
  onSubmit: (text: string) => void
}) {
  const [draft, setDraft] = useState('')
  const submit = (event: FormEvent) => {
    event.preventDefault()
    const text = draft.trim()
    if (!text) return
    onSubmit(text)
    setDraft('')
  }
  return (
    <form onSubmit={submit} className="inline-form">
      <input
        aria-label={label}
        placeholder={label}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
      />
      <button type="submit">{button}</button>
    </form>
  )
}
