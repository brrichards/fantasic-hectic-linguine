import { useState, type FormEvent } from 'react'
import {
  Duration,
  durationUnits,
  Quantity,
  quantityUnits,
  RichText,
  type Ingredient,
  type Note,
  type QuantityUnit,
  type Ingredients,
  type Recipe,
} from '../fluid/schema'
import { useNode } from '../hooks/useNode'
import { RichTextEditor } from '../text/RichTextEditor'
import { RichTextView } from '../text/RichTextView'
import { RecipeView } from './RecipeView'

export type DetailMode = 'view' | 'edit'

interface RecipeDetailProps {
  recipe: Recipe
  /** When given, offers to save this recipe into the user's own book. */
  onSave?: () => void
  saved?: boolean
  /** Whether the recipe opens rendered as a page or in its editors. */
  initialMode?: DetailMode
  /** The author decides whether others may edit and is never locked out. */
  isAuthor?: boolean
  /** Who is signed in: the author of any note added here. */
  userName?: string
}

export function RecipeDetail({
  recipe,
  onSave,
  saved = false,
  initialMode = 'edit',
  isAuthor = false,
  userName = 'anonymous',
}: RecipeDetailProps) {
  useNode(recipe)
  const canEdit = isAuthor || recipe.othersMayEdit
  const [mode, setMode] = useState<DetailMode>(canEdit ? initialMode : 'view')
  // Losing edit rights drops the panel back to the page, and it stays there.
  const [wasEditable, setWasEditable] = useState(canEdit)
  if (wasEditable !== canEdit) {
    setWasEditable(canEdit)
    if (!canEdit) setMode('view')
  }
  const shownMode: DetailMode = canEdit ? mode : 'view'

  const saveButton = onSave && (
    <button type="button" className="save-button" disabled={saved} onClick={onSave}>
      {saved ? 'Saved' : 'Save to my book'}
    </button>
  )

  return (
    <article className="recipe-detail">
      <section className="card-controls">
        <span className="mode-toggle" role="group" aria-label="Mode">
          <button type="button" aria-pressed={shownMode === 'view'} onClick={() => setMode('view')}>
            View
          </button>
          <button
            type="button"
            aria-pressed={shownMode === 'edit'}
            disabled={!canEdit}
            title={canEdit ? undefined : 'The author has not allowed editing'}
            onClick={() => setMode('edit')}
          >
            Edit
          </button>
        </span>
        {isAuthor && (
          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={recipe.othersMayEdit}
              onChange={(event) => (recipe.othersMayEdit = event.target.checked)}
            />
            Allow others to edit
          </label>
        )}
      </section>
      {shownMode === 'view' ? (
        <RecipeView recipe={recipe} titleControls={saveButton} />
      ) : (
        <RecipeEditor recipe={recipe} userName={userName} titleControls={saveButton} />
      )}
    </article>
  )
}

/** Every field of the recipe in its editor. */
function RecipeEditor({
  recipe,
  userName,
  titleControls,
}: {
  recipe: Recipe
  userName: string
  titleControls?: React.ReactNode
}) {
  useNode(recipe)
  useNode(recipe.ingredients)
  useNode(recipe.tags)
  useNode(recipe.notes)

  return (
    <div className="recipe-editor">
      <section className="title-row">
        <div>
          <h3>Title</h3>
          <RichTextEditor node={recipe.title} variant="line" placeholder="Recipe title" />
        </div>
        {titleControls}
      </section>

      <section>
        <h3>Description</h3>
        <RichTextEditor node={recipe.description} variant="prose" placeholder="What is this dish?" />
      </section>

      <section className="number-fields">
        <NumberField label="Servings" value={recipe.servings} onChange={(v) => (recipe.servings = v)} />
        <MeasureField
          label="Prep time"
          value={recipe.prepTime}
          units={durationUnits}
          onChange={(v, unit) => (recipe.prepTime = v === undefined ? undefined : Duration.create(v, unit))}
        />
        <MeasureField
          label="Cook time"
          value={recipe.cookTime}
          units={durationUnits}
          onChange={(v, unit) => (recipe.cookTime = v === undefined ? undefined : Duration.create(v, unit))}
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

      <section className="steps">
        <h3>Steps</h3>
        <RichTextEditor node={recipe.steps} variant="prose" placeholder="How is it made?" />
      </section>

      <section>
        <h3>Tags</h3>
        <ul aria-label="Tags" className="plain-list tag-list">
          {recipe.tags.map((tag, index) => (
            <li key={index} className="row">
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
        <AddNote onAdd={(text) => recipe.notes.add(userName, text)} />
      </section>
    </div>
  )
}

interface MeasureFieldProps<Unit extends string> {
  label: string
  value: { value: number; unit: string } | undefined
  units: readonly Unit[]
  /** Called with the number as typed (unrounded) and the chosen unit, or undefined when cleared. */
  onChange: (value: number | undefined, unit: Unit) => void
  /** Labels the controls for assistive tech only, for use inside a row. */
  labelHidden?: boolean
}

/** A number and a unit. The unit chosen before any number is typed is kept locally. */
function MeasureField<Unit extends string>({
  label,
  value,
  units,
  onChange,
  labelHidden = false,
}: MeasureFieldProps<Unit>) {
  const [pendingUnit, setPendingUnit] = useState<Unit>(units[0])
  const unit = (value?.unit as Unit | undefined) ?? pendingUnit

  const setValue = (raw: string) => {
    onChange(raw === '' ? undefined : Number(raw), unit)
  }
  const setUnit = (next: Unit) => {
    setPendingUnit(next)
    if (value) onChange(value.value, next)
  }

  const inputs = (
    <span className="measure-inputs">
      <input
        type="number"
        min={0}
        step={0.01}
        aria-label={labelHidden ? label : undefined}
        placeholder={labelHidden ? label.toLowerCase() : undefined}
        value={value?.value ?? ''}
        onChange={(event) => setValue(event.target.value)}
      />
      <select
        aria-label={`${label} unit`}
        value={unit}
        onChange={(event) => setUnit(event.target.value as Unit)}
      >
        {units.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </span>
  )
  if (labelHidden) return inputs
  return (
    <label className="number-field">
      {label}
      {inputs}
    </label>
  )
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

function RowControls({
  collection,
  index,
  label,
}: {
  collection: Ingredients
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
        onClick={() => collection.swapWithNext(index - 1)}
      >
        ↑
      </button>
      <button
        type="button"
        className="icon-button"
        aria-label="Move down"
        disabled={index === collection.length - 1}
        onClick={() => collection.swapWithNext(index)}
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
      <RichTextEditor node={ingredient.name} variant="line" placeholder="ingredient" />
      <MeasureField
        label="Quantity"
        labelHidden
        value={ingredient.quantity}
        units={quantityUnits}
        onChange={(v, unit: QuantityUnit) =>
          (ingredient.quantity = v === undefined ? undefined : Quantity.create(v, unit))
        }
      />
      {controls}
    </li>
  )
}

function NoteRow({ note, onRemove }: { note: Note; onRemove: () => void }) {
  return (
    <li className="row note-row">
      <div className="note-header">
        <strong>
          <RichTextView node={note.author} inline />
        </strong>
        <button type="button" className="icon-button" aria-label="Remove note" onClick={onRemove}>
          ×
        </button>
      </div>
      <RichTextEditor node={note.text} variant="prose" placeholder="Write a note" />
    </li>
  )
}

/** A note is written here first, and joins the recipe only once it is added. */
function AddNote({ onAdd }: { onAdd: (text: RichText) => void }) {
  const [draft, setDraft] = useState(() => RichText.fromString(''))
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (draft.fullString().trim() === '') return
    onAdd(draft)
    setDraft(RichText.fromString(''))
  }
  return (
    <form onSubmit={submit} aria-label="New note" className="note-form">
      <RichTextEditor node={draft} variant="prose" placeholder="Write a note" />
      <button type="submit">Add note</button>
    </form>
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
