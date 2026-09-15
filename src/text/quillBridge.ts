import { codePointCount, utf16LengthForCodePoints, type PlainText } from 'fluid-framework/alpha'
import { TreeBeta } from 'fluid-framework/beta'
import type Delta from 'quill-delta'
import type { AttributeMap, Op } from 'quill-delta'
import { CharacterFormat, LineAtom, type LineTag, type RichText } from '../fluid/schema'
import {
  formatToFullQuillAttributes,
  formatToQuillAttributes,
  lineAtomToQuillAttributes,
  lineAttributeKeys,
  lineTagToQuillAttributes,
  parseLineTag,
  quillAttributesToFormat,
  quillAttributesToPartial,
  type QuillAttributes,
} from './quillAttributes'

/*
 * Two index spaces are in play throughout this module:
 *  - Quill counts UTF-16 code units (JavaScript string indices).
 *  - The tree counts atoms, one per Unicode code point.
 * Every position is tracked in both and converted with the code point helpers.
 */

function hasOnlyIndent(attributes: QuillAttributes): boolean {
  return 'indent' in attributes && !lineAttributeKeys.some((key) => key in attributes)
}

function lineAtomInsertable(tag: LineTag, indent = 0) {
  return {
    content: new LineAtom({ tag, indent }),
    format: new CharacterFormat(quillAttributesToFormat()),
  }
}

/**
 * Applies a Quill delta produced by a local user edit to the tree, as one
 * transaction. Embed inserts are ignored.
 */
export function applyQuillDeltaToTree(node: RichText, delta: Delta): void {
  TreeBeta.context(node).runTransaction(() => {
    // A mirror of the tree's text, maintained in lockstep so UTF-16 offsets
    // from Quill can be resolved without re-reading the tree per op.
    let content = node.fullString()
    let utf16Pos = 0
    let cpPos = 0

    for (const op of delta.ops) {
      if (op.retain !== undefined) {
        if (typeof op.retain !== 'number') continue
        const retained = content.slice(utf16Pos, utf16Pos + op.retain)
        const cpCount = codePointCount(retained)

        if (op.attributes) {
          const lineTag = parseLineTag(op.attributes)
          const indent = typeof op.attributes.indent === 'number' ? op.attributes.indent : undefined
          const atNewline = content[utf16Pos] === '\n'
          const currentAtom = node.charactersWithFormatting()[cpPos]?.content

          if (lineTag !== undefined && atNewline) {
            // Line formatting applied to an existing newline: swap in a line atom.
            node.removeRange(cpPos, cpPos + 1)
            node.insertWithFormattingAt(cpPos, [lineAtomInsertable(lineTag, indent)])
          } else if (lineTag !== undefined && utf16Pos >= content.length) {
            // Line formatting applied to Quill's implicit terminal newline,
            // which the tree does not store yet.
            node.insertWithFormattingAt(cpPos, [lineAtomInsertable(lineTag, indent)])
            content += '\n'
          } else if (
            lineTag === undefined &&
            hasOnlyIndent(op.attributes) &&
            atNewline &&
            currentAtom instanceof LineAtom
          ) {
            currentAtom.indent = indent ?? 0
          } else if (lineTag === undefined && atNewline && currentAtom instanceof LineAtom) {
            // Line formatting cleared: back to a plain newline character.
            node.removeRange(cpPos, cpPos + 1)
            node.insertAt(cpPos, '\n')
          } else {
            node.formatRange(cpPos, cpPos + cpCount, quillAttributesToPartial(op.attributes))
          }
        }
        utf16Pos += op.retain
        cpPos += cpCount
      } else if (op.delete !== undefined) {
        const deleted = content.slice(utf16Pos, utf16Pos + op.delete)
        node.removeRange(cpPos, cpPos + codePointCount(deleted))
        content = content.slice(0, utf16Pos) + content.slice(utf16Pos + op.delete)
      } else if (typeof op.insert === 'string') {
        const lineTag = parseLineTag(op.attributes)
        const indent = typeof op.attributes?.indent === 'number' ? op.attributes.indent : undefined
        if (lineTag !== undefined && op.insert === '\n') {
          node.insertWithFormattingAt(cpPos, [lineAtomInsertable(lineTag, indent)])
        } else {
          node.insertAt(cpPos, op.insert, quillAttributesToFormat(op.attributes))
        }
        content = content.slice(0, utf16Pos) + op.insert + content.slice(utf16Pos)
        utf16Pos += op.insert.length
        cpPos += codePointCount(op.insert)
      }
    }
  })
}

function withAttributes(op: Op, attributes: AttributeMap): Op {
  return Object.keys(attributes).length > 0 ? { ...op, attributes } : op
}

/**
 * Renders the whole tree as Quill ops, ending with the newline Quill requires.
 */
export function buildDeltaFromTree(node: RichText): Op[] {
  const ops: Op[] = []
  const atoms = node.charactersWithFormatting()
  let index = 0
  while (index < atoms.length) {
    const atom = atoms[index]
    if (atom.content instanceof LineAtom) {
      ops.push(withAttributes({ insert: '\n' }, lineAtomToQuillAttributes(atom.content)))
      index += 1
    } else {
      const runLength = node.getUniformRun(index)
      const text = node.getString(index, index + runLength)
      ops.push(withAttributes({ insert: text }, formatToQuillAttributes(atom.format)))
      index += runLength
    }
  }
  const last = ops[ops.length - 1]
  if (typeof last?.insert !== 'string' || !last.insert.endsWith('\n')) {
    ops.push({ insert: '\n' })
  }
  return ops
}

/**
 * Converts tree content ops (code point counts, post-edit) into Quill ops
 * (UTF-16 counts) for an editor whose text was `preEditText` before the edit.
 * Returns undefined when the ops cannot be reconciled with the tree, in which
 * case the caller should fall back to a full diff.
 */
export function contentOpsToQuillDelta(
  node: RichText,
  ops: readonly PlainText.TextOp[],
  preEditText: string,
): Op[] | undefined {
  const quillOps: Op[] = []
  const atoms = node.charactersWithFormatting()
  let treePos = 0 // atom index in the post-edit tree
  let quillPos = 0 // UTF-16 index into preEditText

  for (const op of ops) {
    if (op.type === 'retain' && op.formattingChanged !== true) {
      if (treePos + op.count > atoms.length) return undefined
      const text = node.getString(treePos, treePos + op.count)
      quillOps.push({ retain: text.length })
      treePos += op.count
      quillPos += text.length
    } else if (op.type === 'retain') {
      const retainEnd = treePos + op.count
      if (retainEnd > atoms.length) return undefined
      let i = treePos
      while (i < retainEnd) {
        const atom = atoms[i]
        if (atom.content instanceof LineAtom) {
          const attributes: AttributeMap = {
            ...formatToFullQuillAttributes(atom.format),
            ...lineTagToQuillAttributes[atom.content.tag.value],
            // Emit zero as null so Quill clears a previously set indent.
            indent: atom.content.indent > 0 ? atom.content.indent : null,
          }
          quillOps.push({ retain: 1, attributes })
          i += 1
          quillPos += 1
        } else {
          const runLength = Math.min(node.getUniformRun(i, retainEnd), retainEnd - i)
          const text = node.getString(i, i + runLength)
          quillOps.push({ retain: text.length, attributes: formatToFullQuillAttributes(atom.format) })
          i += runLength
          quillPos += text.length
        }
      }
      treePos = retainEnd
    } else if (op.type === 'insert') {
      const insertEnd = treePos + codePointCount(op.text)
      if (insertEnd > atoms.length) return undefined
      let i = treePos
      while (i < insertEnd) {
        const atom = atoms[i]
        if (atom.content instanceof LineAtom) {
          quillOps.push(withAttributes({ insert: '\n' }, lineAtomToQuillAttributes(atom.content)))
          i += 1
        } else {
          const runLength = Math.min(node.getUniformRun(i, insertEnd), insertEnd - i)
          const text = node.getString(i, i + runLength)
          quillOps.push(withAttributes({ insert: text }, formatToQuillAttributes(atom.format)))
          i += runLength
        }
      }
      treePos = insertEnd
    } else {
      // Removed atoms are gone from the tree, so measure them in the pre-edit text.
      let utf16Count: number
      try {
        utf16Count = utf16LengthForCodePoints(preEditText, quillPos, op.count)
      } catch {
        return undefined
      }
      quillOps.push({ delete: utf16Count })
      quillPos += utf16Count
    }
  }

  // Quill always keeps a terminal newline that the tree may not store.
  // Reconcile: drop whatever Quill still holds past the tree's content, then
  // re-add the terminal newline unless the tree already ends with one.
  const remaining = preEditText.slice(quillPos)
  if (remaining.length > 0) {
    if (remaining !== '\n') return undefined
    quillOps.push({ delete: 1 })
  }
  if (!node.fullString().endsWith('\n')) {
    quillOps.push({ insert: '\n' })
  }
  return quillOps
}
