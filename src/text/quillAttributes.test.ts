import { describe, expect, it } from 'vitest'
import { CharacterFormat, LineAtom, LineTag } from '../fluid/schema'
import {
  formatToFullQuillAttributes,
  formatToQuillAttributes,
  lineAtomToQuillAttributes,
  parseLineTag,
  quillAttributesToFormat,
  quillAttributesToPartial,
} from './quillAttributes'

describe('quillAttributesToFormat', () => {
  it('returns all-false formatting when no attributes are given', () => {
    expect(quillAttributesToFormat(undefined)).toEqual({
      bold: false,
      italic: false,
      underline: false,
    })
  })

  it('turns on only the attributes that are true', () => {
    expect(quillAttributesToFormat({ bold: true, italic: null, header: 1 })).toEqual({
      bold: true,
      italic: false,
      underline: false,
    })
  })
})

describe('quillAttributesToPartial', () => {
  it('returns an empty partial for no attributes', () => {
    expect(quillAttributesToPartial(undefined)).toEqual({})
  })

  it('maps a null attribute to false and leaves unmentioned fields out', () => {
    expect(quillAttributesToPartial({ italic: null })).toEqual({ italic: false })
    expect(quillAttributesToPartial({ underline: true })).toEqual({ underline: true })
  })

  it('ignores line attributes', () => {
    expect(quillAttributesToPartial({ header: 2, list: 'bullet' })).toEqual({})
  })
})

describe('formatToQuillAttributes', () => {
  it('omits formats that are off', () => {
    const format = new CharacterFormat({ bold: true, italic: false, underline: false })
    expect(formatToQuillAttributes(format)).toEqual({ bold: true })
  })

  it('is empty for the default format', () => {
    const format = new CharacterFormat({ bold: false, italic: false, underline: false })
    expect(formatToQuillAttributes(format)).toEqual({})
  })
})

describe('formatToFullQuillAttributes', () => {
  it('emits null for formats that are off so Quill clears them', () => {
    const format = new CharacterFormat({ bold: false, italic: true, underline: false })
    expect(formatToFullQuillAttributes(format)).toEqual({
      bold: null,
      italic: true,
      underline: null,
    })
  })
})

describe('parseLineTag', () => {
  it('returns undefined when there are no line attributes', () => {
    expect(parseLineTag(undefined)).toBeUndefined()
    expect(parseLineTag({ bold: true })).toBeUndefined()
  })

  it('maps headers to h1..h5 and clamps larger headers to h5', () => {
    expect(parseLineTag({ header: 2 })?.value).toBe('h2')
    expect(parseLineTag({ header: 6 })?.value).toBe('h5')
  })

  it('maps list kinds', () => {
    expect(parseLineTag({ list: 'bullet' })?.value).toBe('li')
    expect(parseLineTag({ list: 'ordered' })?.value).toBe('ol')
    expect(parseLineTag({ list: 'checked' })?.value).toBe('checked')
    expect(parseLineTag({ list: 'unchecked' })?.value).toBe('unchecked')
  })

  it('maps blockquote and code-block', () => {
    expect(parseLineTag({ blockquote: true })?.value).toBe('blockquote')
    expect(parseLineTag({ 'code-block': 'plain' })?.value).toBe('codeBlock')
  })

  it('treats a null line attribute as cleared', () => {
    expect(parseLineTag({ header: null })).toBeUndefined()
  })

  it('throws when more than one line attribute is set at once', () => {
    expect(() => parseLineTag({ header: 1, list: 'bullet' })).toThrow()
  })
})

describe('lineAtomToQuillAttributes', () => {
  it('emits the line attribute and omits a zero indent', () => {
    const atom = new LineAtom({ tag: LineTag('ol'), indent: 0 })
    expect(lineAtomToQuillAttributes(atom)).toEqual({ list: 'ordered' })
  })

  it('includes a positive indent', () => {
    const atom = new LineAtom({ tag: LineTag('li'), indent: 2 })
    expect(lineAtomToQuillAttributes(atom)).toEqual({ list: 'bullet', indent: 2 })
  })
})
