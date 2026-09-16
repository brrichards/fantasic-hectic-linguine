import { render } from '@testing-library/react'
import { TreeViewConfiguration } from 'fluid-framework'
import { createIndependentTreeView } from 'fluid-framework/beta'
import Quill from 'quill'
import { act } from 'react'
import { describe, expect, it } from 'vitest'
import { LineAtom, RichText } from '../fluid/schema'
import { RichTextEditor } from './RichTextEditor'

const richTextConfig = new TreeViewConfiguration({ schema: RichText })

function hydrated(initial: string): RichText {
  const view = createIndependentTreeView(richTextConfig)
  view.initialize(RichText.fromString(initial))
  return view.root
}

/** Finds the Quill instance and editor element inside a rendered editor component. */
function quillIn(container: HTMLElement, nth = 0) {
  const host = container.querySelectorAll<HTMLElement>('.ql-container')[nth]
  const quill = Quill.find(host)
  if (!(quill instanceof Quill)) throw new Error('Quill instance not found')
  return quill
}

describe('RichTextEditor', () => {
  it('writes user typing and inline formatting into the node', () => {
    const node = hydrated('Hello')
    const { container } = render(<RichTextEditor node={node} variant="prose" />)
    const quill = quillIn(container)
    act(() => {
      quill.insertText(5, ' world', 'user')
      quill.formatText(0, 5, 'bold', true, 'user')
    })
    expect(node.fullString()).toBe('Hello world')
    const bold = node.charactersWithFormatting().map((a) => a.format.bold)
    expect(bold.slice(0, 5)).toEqual([true, true, true, true, true])
    expect(bold.slice(5).some(Boolean)).toBe(false)
  })

  it('reflects edits made directly on the node', () => {
    const node = hydrated('Hello')
    const { container } = render(<RichTextEditor node={node} variant="prose" />)
    act(() => {
      node.insertAt(0, 'Oh ')
      node.formatRange(0, 2, { italic: true })
    })
    const quill = quillIn(container)
    expect(quill.getText()).toBe('Oh Hello\n')
    expect(quill.getContents().ops[0]).toEqual({ insert: 'Oh', attributes: { italic: true } })
  })

  it('keeps two editors on the same node identical', () => {
    const node = hydrated('')
    const { container } = render(
      <>
        <RichTextEditor node={node} variant="prose" />
        <RichTextEditor node={node} variant="prose" />
      </>,
    )
    const source = quillIn(container, 0)
    const mirror = quillIn(container, 1)
    act(() => {
      source.insertText(0, 'Shopping list', 'user')
      source.formatText(0, 8, 'underline', true, 'user')
      source.formatLine(0, 1, 'list', 'bullet', 'user')
      source.insertText(13, '\nmilk', 'user')
    })
    expect(mirror.getContents().ops).toEqual(source.getContents().ops)
    expect(mirror.root.innerHTML).toBe(source.root.innerHTML)
    // The bullet on the last line lives on its newline, so the tree stores it.
    expect(node.fullString()).toBe('Shopping list\nmilk\n')
    const atoms = node.charactersWithFormatting()
    expect(atoms[13].content).toBeInstanceOf(LineAtom)
    expect(atoms[18].content).toBeInstanceOf(LineAtom)
  })

  it('renders a toolbar for the prose variant only', () => {
    const node = hydrated('')
    const prose = render(<RichTextEditor node={node} variant="prose" />)
    expect(prose.container.querySelector('.ql-toolbar')).not.toBeNull()
    prose.unmount()
    const line = render(<RichTextEditor node={node} variant="line" />)
    expect(line.container.querySelector('.ql-toolbar')).toBeNull()
  })

  it('keeps the line variant on a single line when text with newlines is inserted', () => {
    const node = hydrated('ab')
    const { container } = render(<RichTextEditor node={node} variant="line" />)
    const quill = quillIn(container)
    act(() => {
      quill.insertText(1, 'x\ny', 'user')
    })
    expect(node.fullString()).toBe('axyb')
    expect(quill.getText()).toBe('axyb\n')
  })

  it('ignores the Enter key in the line variant', () => {
    const node = hydrated('ab')
    const { container } = render(<RichTextEditor node={node} variant="line" />)
    const quill = quillIn(container)
    act(() => {
      // jsdom cannot scroll a selection into view, so place the caret silently.
      quill.setSelection(1, 0, 'silent')
      quill.root.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
      )
    })
    expect(quill.getText()).toBe('ab\n')
    expect(node.fullString()).toBe('ab')
  })
})
