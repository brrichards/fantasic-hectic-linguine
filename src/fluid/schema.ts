import { TreeViewConfiguration } from 'fluid-framework'
import { FormattedText } from 'fluid-framework/alpha'
import { SchemaFactoryBeta, enumFromStrings } from 'fluid-framework/beta'

const sf = new SchemaFactoryBeta('fhl.recipes')

// #region Rich text

export class CharacterFormat extends sf.object('CharacterFormat', {
  bold: sf.boolean,
  italic: sf.boolean,
  underline: sf.boolean,
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
  'blockquote',
])
export type LineTag = ReturnType<typeof LineTag>

/** A newline character that carries line formatting. Plain newlines are ordinary text atoms. */
export class LineAtom extends sf.object('LineAtom', {
  tag: LineTag.schema,
  indent: sf.number,
}) {
  readonly content = '\n'
}

export class RichText extends FormattedText.createSchema(sf, CharacterFormat, [LineAtom], defaultFormat) {}

// #endregion

// #region Recipe domain

export const quantityUnits = [
  'none',
  'tsp',
  'tbsp',
  'cup',
  'fl oz',
  'ml',
  'l',
  'oz',
  'lb',
  'g',
  'kg',
  'pinch',
] as const
export type QuantityUnit = (typeof quantityUnits)[number]

/** How much of an ingredient: a value to two decimal places and a kitchen unit. */
export class Quantity extends sf.object('Quantity', {
  value: sf.number,
  unit: sf.string,
}) {
  /** Rounds `value` to hundredths so nothing finer than that is ever stored. */
  static create(value: number, unit: QuantityUnit): Quantity {
    return new Quantity({ value: roundToHundredths(value), unit })
  }
}

export class Ingredient extends sf.object('Ingredient', {
  id: sf.identifier,
  name: RichText,
  quantity: sf.optional(Quantity),
}) {}

export class Ingredients extends sf.array('Ingredients', Ingredient) {
  add(): Ingredient {
    const ingredient = new Ingredient({ name: RichText.fromString('') })
    this.insertAtEnd(ingredient)
    return ingredient
  }
  /** Swaps the item at `index` with the one after it. */
  swapWithNext(index: number): void {
    this.moveToIndex(index, index + 1)
  }
}

export class Note extends sf.object('Note', {
  id: sf.identifier,
  author: RichText,
  text: RichText,
  createdAt: sf.number,
}) {}

export class Notes extends sf.array('Notes', Note) {
  add(author: string, text: RichText): Note {
    const note = new Note({
      author: RichText.fromString(author),
      text,
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

/** Rounds half up at the second decimal; the epsilon keeps 1.005 from landing on 1. */
const roundToHundredths = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100

export const durationUnits = ['minutes', 'hours', 'days'] as const
export type DurationUnit = (typeof durationUnits)[number]

/** A length of time as it was entered: a value to two decimal places and its unit. */
export class Duration extends sf.object('Duration', {
  value: sf.number,
  unit: sf.string,
}) {
  /** Rounds `value` to hundredths so nothing finer than that is ever stored. */
  static create(value: number, unit: DurationUnit): Duration {
    return new Duration({ value: roundToHundredths(value), unit })
  }
}

/** The root of a recipe container. One container per recipe. */
export class Recipe extends sf.object('Recipe', {
  title: RichText,
  description: RichText,
  sourceUrl: RichText,
  servings: sf.optional(sf.number),
  prepTime: sf.optional(Duration),
  cookTime: sf.optional(Duration),
  ingredients: Ingredients,
  steps: RichText,
  tags: Tags,
  notes: Notes,
  /** The id of the author's book container, which is how the app identifies a person. */
  authorId: sf.string,
  /** Whether people other than the author may switch the recipe into edit mode. */
  othersMayEdit: sf.boolean,
}) {
  /** A blank recipe with the given title and author. */
  static create(title: string, authorId: string): Recipe {
    return new Recipe({
      authorId,
      title: RichText.fromString(title),
      description: RichText.fromString(''),
      sourceUrl: RichText.fromString(''),
      ingredients: [],
      steps: RichText.fromString(''),
      tags: [],
      notes: [],
      othersMayEdit: true,
    })
  }
}

export const recipeConfig = new TreeViewConfiguration({ schema: Recipe })

// #endregion

// #region Recipe book: one container per user, holding a card per recipe

/**
 * A set of tag strings keyed by tag. A map, not an array, so two clients that
 * project the same recipe at once converge to one entry per tag.
 */
export class CardTags extends sf.map('CardTags', sf.boolean) {}

/**
 * A projection of one recipe. `id` is the id of the container that holds the
 * recipe. The other fields are copied from the recipe by the projector;
 * nothing edits them by hand.
 */
export class RecipeCard extends sf.object('RecipeCard', {
  id: sf.string,
  title: sf.string,
  tags: CardTags,
  authorId: sf.string,
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
  /** What the book's owner called it when creating it. */
  name: sf.string,
  cards: RecipeCards,
}) {}

export const bookConfig = new TreeViewConfiguration({ schema: RecipeBook })

// #endregion
