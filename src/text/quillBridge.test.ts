import { TreeViewConfiguration } from 'fluid-framework'
import type { PlainText } from 'fluid-framework/alpha'
import { createIndependentTreeView } from 'fluid-framework/beta'
import Delta, { type Op } from 'quill-delta'
import { describe, expect, it } from 'vitest'
import { LineAtom, RichText } from '../fluid/schema'
import { applyQuillDeltaToTree, buildDeltaFromTree, contentOpsToQuillDelta } from './quillBridge'

const richTextConfig = new TreeViewConfiguration({ schema: RichText })

/** A hydrated RichText node so change events fire the way they do in a container. */
function hydrated(initial: string): RichText {
  const view = createIndependentTreeView(richTextConfig)
  view.initialize(RichText.fromString(initial))
  return view.root
}

const atoms = (node: RichText) => node.charactersWithFormatting()
const isLine = (node: RichText, index: number) => atoms(node)[index]?.content instanceof LineAtom

describe('applyQuillDeltaToTree', () => {
  it('inserts plain text with the default format', () => {
    const node = hydrated('')
    applyQuillDeltaToTree(node, new Delta().insert('Hello'))
    expect(node.fullString()).toBe('Hello')
    expect(atoms(node).every((a) => !a.format.bold && !a.format.italic)).toBe(true)
  })

  it('inserts text carrying the given inline format', () => {
    const node = hydrated('')
    applyQuillDeltaToTree(node, new Delta().insert('Hi', { bold: true }))
    expect(node.fullString()).toBe('Hi')
    expect(atoms(node).every((a) => a.format.bold)).toBe(true)
  })

  it('inserts into the middle of existing text', () => {
    const node = hydrated('Ho')
    applyQuillDeltaToTree(node, new Delta().retain(1).insert('ell'))
    expect(node.fullString()).toBe('Hello')
  })

  it('deletes a range', () => {
    const node = hydrated('Hello')
    applyQuillDeltaToTree(node, new Delta().retain(1).delete(3))
    expect(node.fullString()).toBe('Ho')
  })

  it('applies inline formatting to a retained range only', () => {
    const node = hydrated('Hello')
    applyQuillDeltaToTree(node, new Delta().retain(1).retain(3, { bold: true }))
    expect(atoms(node).map((a) => a.format.bold)).toEqual([false, true, true, true, false])
  })

  it('clears inline formatting when the attribute is null', () => {
    const node = hydrated('')
    applyQuillDeltaToTree(node, new Delta().insert('Hi', { italic: true }))
    applyQuillDeltaToTree(node, new Delta().retain(2, { italic: null }))
    expect(atoms(node).every((a) => !a.format.italic)).toBe(true)
  })

  it('inserts a newline with a header attribute as a line atom', () => {
    const node = hydrated('')
    applyQuillDeltaToTree(node, new Delta().insert('Title').insert('\n', { header: 1 }))
    expect(node.fullString()).toBe('Title\n')
    expect(isLine(node, 5)).toBe(true)
    const line = atoms(node)[5].content as LineAtom
    expect(line.tag.value).toBe('h1')
    expect(line.indent).toBe(0)
  })

  it('inserts a plain newline as ordinary text', () => {
    const node = hydrated('')
    applyQuillDeltaToTree(node, new Delta().insert('a\nb'))
    expect(node.fullString()).toBe('a\nb')
    expect(isLine(node, 1)).toBe(false)
  })

  it('turns an existing newline into a line atom when a list attribute is applied', () => {
    const node = hydrated('a\nb')
    applyQuillDeltaToTree(node, new Delta().retain(1).retain(1, { list: 'bullet' }))
    expect(node.fullString()).toBe('a\nb')
    expect(isLine(node, 1)).toBe(true)
    expect((atoms(node)[1].content as LineAtom).tag.value).toBe('li')
  })

  it('applies line formatting past the end of content by appending a line atom', () => {
    const node = hydrated('Title')
    applyQuillDeltaToTree(node, new Delta().retain(5).retain(1, { header: 2 }))
    expect(node.fullString()).toBe('Title\n')
    expect(isLine(node, 5)).toBe(true)
    expect((atoms(node)[5].content as LineAtom).tag.value).toBe('h2')
  })

  it('changes only the indent of an existing line atom', () => {
    const node = hydrated('a\nb')
    applyQuillDeltaToTree(node, new Delta().retain(1).retain(1, { list: 'bullet' }))
    const before = atoms(node)[1].content
    applyQuillDeltaToTree(node, new Delta().retain(1).retain(1, { indent: 1 }))
    expect(atoms(node)[1].content).toBe(before)
    expect((atoms(node)[1].content as LineAtom).indent).toBe(1)
  })

  it('turns a line atom back into a plain newline when the line attribute is cleared', () => {
    const node = hydrated('a\nb')
    applyQuillDeltaToTree(node, new Delta().retain(1).retain(1, { header: 1 }))
    applyQuillDeltaToTree(node, new Delta().retain(1).retain(1, { header: null }))
    expect(node.fullString()).toBe('a\nb')
    expect(isLine(node, 1)).toBe(false)
  })

  it('deletes an emoji using UTF-16 lengths from Quill', () => {
    const node = hydrated('a😀b')
    applyQuillDeltaToTree(node, new Delta().retain(1).delete(2))
    expect(node.fullString()).toBe('ab')
  })

  it('formats text after an emoji using UTF-16 offsets from Quill', () => {
    const node = hydrated('😀xy')
    applyQuillDeltaToTree(node, new Delta().retain(2).retain(1, { bold: true }))
    expect(atoms(node).map((a) => a.format.bold)).toEqual([false, true, false])
  })

  it('ignores embed inserts', () => {
    const node = hydrated('ab')
    applyQuillDeltaToTree(node, new Delta().retain(1).insert({ image: 'x.png' }))
    expect(node.fullString()).toBe('ab')
  })
})

describe('buildDeltaFromTree', () => {
  it('produces just the terminal newline for empty text', () => {
    expect(buildDeltaFromTree(hydrated(''))).toEqual([{ insert: '\n' }])
  })

  it('appends the terminal newline after unformatted text', () => {
    expect(buildDeltaFromTree(hydrated('Hi'))).toEqual([{ insert: 'Hi' }, { insert: '\n' }])
  })

  it('splits runs by formatting and emits line atoms with their attributes', () => {
    const node = hydrated('')
    applyQuillDeltaToTree(
      node,
      new Delta().insert('Hi', { bold: true }).insert('\n', { header: 1 }).insert('x'),
    )
    expect(buildDeltaFromTree(node)).toEqual([
      { insert: 'Hi', attributes: { bold: true } },
      { insert: '\n', attributes: { header: 1 } },
      { insert: 'x' },
      { insert: '\n' },
    ])
  })

  it('does not add a second newline when the text already ends with one', () => {
    const node = hydrated('')
    applyQuillDeltaToTree(node, new Delta().insert('a').insert('\n', { list: 'bullet' }))
    expect(buildDeltaFromTree(node)).toEqual([
      { insert: 'a' },
      { insert: '\n', attributes: { list: 'bullet' } },
    ])
  })
})

describe('contentOpsToQuillDelta', () => {
  const textOf = (doc: Delta) =>
    doc.ops.map((op) => (typeof op.insert === 'string' ? op.insert : '')).join('')

  /** Quill merges adjacent inserts with equal attributes; compare in that canonical form. */
  const normalize = (ops: Op[]) => new Delta().compose(new Delta(ops)).ops

  /**
   * Simulates a Quill editor that mirrored the tree before `edit`: every
   * content event is translated by the bridge and composed onto the document,
   * exactly as the editor component does. Afterwards the document must equal
   * a fresh render of the tree. Returns every Quill op the bridge produced.
   */
  function expectConverged(node: RichText, edit: () => void): Op[] {
    let doc = new Delta(buildDeltaFromTree(node))
    const produced: Op[] = []
    let events = 0
    const off = node.onContentChanged((ops: readonly PlainText.TextOp[] | undefined) => {
      events += 1
      expect(ops).toBeDefined()
      const quillOps = contentOpsToQuillDelta(node, ops!, textOf(doc))
      expect(quillOps).toBeDefined()
      produced.push(...quillOps!)
      doc = doc.compose(new Delta(quillOps!))
    })
    edit()
    off()
    expect(events).toBeGreaterThan(0)
    expect(normalize(doc.ops)).toEqual(normalize(buildDeltaFromTree(node)))
    return produced
  }

  it('converges after an append', () => {
    const node = hydrated('Hello')
    expectConverged(node, () => node.insertAt(5, ' world'))
  })

  it('converges after an insert in the middle', () => {
    const node = hydrated('Ho')
    expectConverged(node, () => node.insertAt(1, 'ell'))
  })

  it('converges after a formatted insert', () => {
    const node = hydrated('ab')
    expectConverged(node, () => node.insertAt(1, 'X', { bold: true, italic: false, underline: false }))
  })

  it('converges after a removal', () => {
    const node = hydrated('Hello')
    expectConverged(node, () => node.removeRange(1, 4))
  })

  it('emits a UTF-16 delete count when an emoji is removed', () => {
    const node = hydrated('a😀b')
    const ops = expectConverged(node, () => node.removeRange(1, 2))
    expect(ops).toContainEqual({ delete: 2 })
  })

  it('converges after formatting a range', () => {
    const node = hydrated('Hello')
    expectConverged(node, () => node.formatRange(1, 4, { bold: true }))
  })

  it('converges after formatting a range that follows an emoji', () => {
    const node = hydrated('😀xy')
    expectConverged(node, () => node.formatRange(1, 2, { italic: true }))
  })

  it('converges after inserting a line atom', () => {
    const node = hydrated('Title')
    expectConverged(node, () =>
      applyQuillDeltaToTree(node, new Delta().retain(5).retain(1, { header: 1 })),
    )
  })

  it('converges after a line atom is replaced by a plain newline', () => {
    const node = hydrated('a\nb')
    applyQuillDeltaToTree(node, new Delta().retain(1).retain(1, { list: 'ordered' }))
    expectConverged(node, () =>
      applyQuillDeltaToTree(node, new Delta().retain(1).retain(1, { list: null })),
    )
  })

  it('converges after an indent change on a line atom', () => {
    const node = hydrated('a\nb')
    applyQuillDeltaToTree(node, new Delta().retain(1).retain(1, { list: 'bullet' }))
    expectConverged(node, () =>
      applyQuillDeltaToTree(node, new Delta().retain(1).retain(1, { indent: 2 })),
    )
  })

  it('converges after a mixed transaction that inserts and removes', () => {
    const node = hydrated('abc')
    expectConverged(node, () =>
      applyQuillDeltaToTree(node, new Delta().retain(1).delete(1).insert('XY', { underline: true })),
    )
  })

  it('returns undefined when the ops do not match the tree', () => {
    const node = hydrated('ab')
    const stale: PlainText.TextOp[] = [{ type: 'retain', count: 10 }]
    expect(contentOpsToQuillDelta(node, stale, 'ab\n')).toBeUndefined()
  })
})
