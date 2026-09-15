import { TreeViewConfiguration } from 'fluid-framework'
import { FormattedText } from 'fluid-framework/alpha'
import { SchemaFactoryBeta, enumFromStrings } from 'fluid-framework/beta'

const sf = new SchemaFactoryBeta('fhl.recipes')

// --- Rich text -------------------------------------------------------------

export class CharacterFormat extends sf.object('CharacterFormat', {
  bold: SchemaFactoryBeta.boolean,
  italic: SchemaFactoryBeta.boolean,
  underline: SchemaFactoryBeta.boolean,
}) {}

export const defaultFormat = { bold: false, italic: false, underline: false } as const

/** Block-level formatting carried by a line break, mirroring Quill's line attributes. */
export const LineTag = enumFromStrings(sf.scopedFactory('lineTag'), [
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'li',
  'ol',
  'checked',
  'unchecked',
  'blockquote',
  'codeBlock',
])
export type LineTag = ReturnType<typeof LineTag>

/** A newline character that carries line formatting. Plain newlines are ordinary text atoms. */
export class LineAtom extends sf.object('LineAtom', {
  tag: LineTag.schema,
  indent: SchemaFactoryBeta.number,
}) {
  readonly content = '\n'
}

export class RichText extends FormattedText.createSchema(
  sf,
  CharacterFormat,
  [LineAtom],
  defaultFormat,
) {}

// --- Recipe domain ---------------------------------------------------------

/**
 * Computes the `destinationGap` for `moveToIndex` so that the item at
 * `from` ends up at index `to` after the move. Gaps are numbered between
 * items *before* the move, so moving forward needs the gap after `to`.
 */
function gapFor(from: number, to: number): number {
  return to > from ? to + 1 : to
}

export class Ingredient extends sf.object('Ingredient', {
  id: sf.identifier,
  quantity: sf.optional(SchemaFactoryBeta.number),
  unit: RichText,
  name: RichText,
  note: RichText,
}) {}

export class Ingredients extends sf.array('Ingredients', Ingredient) {
  add(): Ingredient {
    const ingredient = new Ingredient({
      unit: RichText.fromString(''),
      name: RichText.fromString(''),
      note: RichText.fromString(''),
    })
    this.insertAtEnd(ingredient)
    return ingredient
  }
  move(from: number, to: number): void {
    if (from !== to) this.moveToIndex(gapFor(from, to), from)
  }
}

export class Step extends sf.object('Step', {
  id: sf.identifier,
  text: RichText,
}) {}

export class Steps extends sf.array('Steps', Step) {
  add(): Step {
    const step = new Step({ text: RichText.fromString('') })
    this.insertAtEnd(step)
    return step
  }
  move(from: number, to: number): void {
    if (from !== to) this.moveToIndex(gapFor(from, to), from)
  }
}

export class Note extends sf.object('Note', {
  id: sf.identifier,
  author: RichText,
  text: RichText,
  createdAt: SchemaFactoryBeta.number,
}) {}

export class Notes extends sf.array('Notes', Note) {
  add(author: string): Note {
    const note = new Note({
      author: RichText.fromString(author),
      text: RichText.fromString(''),
      createdAt: Date.now(),
    })
    this.insertAtEnd(note)
    return note
  }
}

export class Tags extends sf.array('Tags', RichText) {
  add(text: string): RichText {
    const tag = RichText.fromString(text)
    this.insertAtEnd(tag)
    return tag
  }
}

/** The root of a recipe container. One container per recipe. */
export class Recipe extends sf.object('Recipe', {
  id: sf.identifier,
  title: RichText,
  description: RichText,
  sourceUrl: RichText,
  servings: sf.optional(SchemaFactoryBeta.number),
  prepMinutes: sf.optional(SchemaFactoryBeta.number),
  cookMinutes: sf.optional(SchemaFactoryBeta.number),
  ingredients: Ingredients,
  steps: Steps,
  tags: Tags,
  notes: Notes,
}) {
  /** A blank recipe with the given title. Pass `id` to share it with the recipe's card. */
  static create(title: string, id?: string): Recipe {
    return new Recipe({
      ...(id === undefined ? {} : { id }),
      title: RichText.fromString(title),
      description: RichText.fromString(''),
      sourceUrl: RichText.fromString(''),
      ingredients: [],
      steps: [],
      tags: [],
      notes: [],
    })
  }
}

export const recipeConfig = new TreeViewConfiguration({ schema: Recipe })

// --- Recipe book: one container per user, holding a card per recipe -------

export const visibilities = ['private', 'view', 'edit'] as const
export type Visibility = (typeof visibilities)[number]

/**
 * A set of tag strings keyed by tag. A map, not an array, so two clients that
 * project the same recipe at once converge to one entry per tag.
 */
export class CardTags extends sf.map('CardTags', SchemaFactoryBeta.boolean) {}

/**
 * A projection of one recipe plus the id of the container that holds it.
 * `title` and `tags` are copied from the recipe by the projector; nothing
 * edits them by hand. `originBookId` is the book the recipe was created in,
 * which stands in for its author until profiles exist.
 */
export class RecipeCard extends sf.object('RecipeCard', {
  id: sf.identifier,
  containerId: SchemaFactoryBeta.string,
  title: SchemaFactoryBeta.string,
  tags: CardTags,
  originBookId: sf.optional(SchemaFactoryBeta.string),
  visibility: SchemaFactoryBeta.string,
  updatedAt: SchemaFactoryBeta.number,
}) {}

export class RecipeCards extends sf.array('RecipeCards', RecipeCard) {
  add(card: RecipeCard): RecipeCard {
    this.insertAtEnd(card)
    return card
  }
  findById(id: string): RecipeCard | undefined {
    return this.find((card) => card.id === id)
  }
  removeById(id: string): void {
    const index = this.findIndex((card) => card.id === id)
    if (index !== -1) this.removeAt(index)
  }
}

/** The root of a book container. */
export class RecipeBook extends sf.object('RecipeBook', {
  cards: RecipeCards,
}) {}

export const bookConfig = new TreeViewConfiguration({ schema: RecipeBook })
