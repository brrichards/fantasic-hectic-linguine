import type { AttributeMap } from 'quill-delta'
import { CharacterFormat, LineAtom, LineTag } from '../fluid/schema'

/** Loosely typed Quill attributes as they arrive on delta ops. */
export type QuillAttributes = Record<string, unknown>

type LineTagValue = LineTag['value']

const headerToLineTag: Record<number, LineTagValue> = {
  1: 'h1',
  2: 'h2',
  3: 'h3',
  4: 'h4',
  5: 'h5',
}

const listToLineTag: Record<string, LineTagValue | undefined> = {
  bullet: 'li',
  ordered: 'ol',
  checked: 'checked',
  unchecked: 'unchecked',
}

export const lineTagToQuillAttributes: Record<LineTagValue, AttributeMap> = {
  h1: { header: 1 },
  h2: { header: 2 },
  h3: { header: 3 },
  h4: { header: 4 },
  h5: { header: 5 },
  li: { list: 'bullet' },
  ol: { list: 'ordered' },
  checked: { list: 'checked' },
  unchecked: { list: 'unchecked' },
  blockquote: { blockquote: true },
  codeBlock: { 'code-block': 'plain' },
}

/** Quill attribute names that describe a whole line rather than characters. */
export const lineAttributeKeys = ['header', 'list', 'blockquote', 'code-block'] as const

/**
 * Reads the line-level attribute out of a Quill attribute map, if any.
 * Quill puts line formatting on the newline character; only one line
 * attribute is valid at a time.
 */
export function parseLineTag(attributes?: QuillAttributes): LineTag | undefined {
  if (!attributes) return undefined
  const present = lineAttributeKeys.filter(
    (key) => attributes[key] !== null && attributes[key] !== undefined,
  )
  if (present.length > 1) {
    throw new Error(`Expected at most one line attribute, got ${present.join(', ')}`)
  }
  if (typeof attributes.header === 'number') {
    return LineTag(headerToLineTag[attributes.header] ?? 'h5')
  }
  if (typeof attributes.list === 'string') {
    const tag = listToLineTag[attributes.list]
    if (tag !== undefined) return LineTag(tag)
  }
  if (attributes.blockquote === true) return LineTag('blockquote')
  if (typeof attributes['code-block'] === 'string') return LineTag('codeBlock')
  return undefined
}

/** Full character format for newly inserted text. Absent attributes are off. */
export function quillAttributesToFormat(attributes?: QuillAttributes) {
  return {
    bold: attributes?.bold === true,
    italic: attributes?.italic === true,
    underline: attributes?.underline === true,
  }
}

/** Partial character format for a retain-with-attributes op. Only mentioned keys are set. */
export function quillAttributesToPartial(
  attributes?: QuillAttributes,
): Partial<CharacterFormat> {
  if (!attributes) return {}
  const format: Partial<CharacterFormat> = {}
  if ('bold' in attributes) format.bold = attributes.bold === true
  if ('italic' in attributes) format.italic = attributes.italic === true
  if ('underline' in attributes) format.underline = attributes.underline === true
  return format
}

/** Minimal Quill attributes for an insert: only formats that are on. */
export function formatToQuillAttributes(format: CharacterFormat): AttributeMap {
  const attributes: AttributeMap = {}
  if (format.bold) attributes.bold = true
  if (format.italic) attributes.italic = true
  if (format.underline) attributes.underline = true
  return attributes
}

/** Full Quill attributes for a retain: off formats are `null` so Quill clears them. */
export function formatToFullQuillAttributes(format: CharacterFormat): AttributeMap {
  return {
    bold: format.bold ? true : null,
    italic: format.italic ? true : null,
    underline: format.underline ? true : null,
  }
}

/** Quill attributes for a line atom's newline: its line tag and any positive indent. */
export function lineAtomToQuillAttributes(atom: LineAtom): AttributeMap {
  const attributes: AttributeMap = { ...lineTagToQuillAttributes[atom.tag.value] }
  if (atom.indent > 0) attributes.indent = atom.indent
  return attributes
}
