import { render, screen } from '@testing-library/react'
import { TreeViewConfiguration } from 'fluid-framework'
import { createIndependentTreeView } from 'fluid-framework/beta'
import Delta from 'quill-delta'
import { describe, expect, it } from 'vitest'
import { RichText } from '../fluid/schema'
import { applyQuillDeltaToTree } from './quillBridge'
import { RichTextView } from './RichTextView'

const richTextConfig = new TreeViewConfiguration({ schema: RichText })

/** A hydrated node filled through the same bridge the editor uses. */
function nodeFrom(delta: Delta): RichText {
  const view = createIndependentTreeView(richTextConfig)
  view.initialize(RichText.fromString(''))
  applyQuillDeltaToTree(view.root, delta)
  return view.root
}

describe('RichTextView', () => {
  it('renders inline formatting as strong, em, and u inside a paragraph', () => {
    const node = nodeFrom(
      new Delta()
        .insert('Hi', { bold: true })
        .insert(' there', { italic: true })
        .insert('!', { underline: true }),
    )
    const { container } = render(<RichTextView node={node} />)
    const paragraph = container.querySelector('p')
    expect(paragraph).not.toBeNull()
    expect(paragraph?.querySelector('strong')).toHaveTextContent('Hi')
    expect(paragraph?.querySelector('em')?.textContent).toBe(' there')
    expect(paragraph?.querySelector('u')).toHaveTextContent('!')
    expect(paragraph).toHaveTextContent('Hi there!')
  })

  it('renders each plain newline as a paragraph break', () => {
    const node = nodeFrom(new Delta().insert('first\nsecond'))
    const { container } = render(<RichTextView node={node} />)
    expect([...container.querySelectorAll('p')].map((p) => p.textContent)).toEqual(['first', 'second'])
  })

  it('renders header lines as headings', () => {
    const node = nodeFrom(new Delta().insert('Title').insert('\n', { header: 2 }).insert('Body'))
    render(<RichTextView node={node} />)
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Title')
    expect(screen.getByText('Body').tagName).toBe('P')
  })

  it('groups consecutive bullet lines into one list and ordered lines into another', () => {
    const node = nodeFrom(
      new Delta()
        .insert('a')
        .insert('\n', { list: 'bullet' })
        .insert('b')
        .insert('\n', { list: 'bullet' })
        .insert('c')
        .insert('\n', { list: 'ordered' }),
    )
    const { container } = render(<RichTextView node={node} />)
    const lists = container.querySelectorAll('ul, ol')
    expect([...lists].map((l) => l.tagName)).toEqual(['UL', 'OL'])
    expect([...lists[0].querySelectorAll('li')].map((li) => li.textContent)).toEqual(['a', 'b'])
    expect([...lists[1].querySelectorAll('li')].map((li) => li.textContent)).toEqual(['c'])
  })

  it('renders blockquote lines', () => {
    const node = nodeFrom(new Delta().insert('quote').insert('\n', { blockquote: true }))
    const { container } = render(<RichTextView node={node} />)
    expect(container.querySelector('blockquote')).toHaveTextContent('quote')
  })

  it('renders inline mode as formatted text with no block elements', () => {
    const node = nodeFrom(new Delta().insert('Soup', { bold: true }).insert(' of the day'))
    const { container } = render(
      <h2>
        <RichTextView node={node} inline />
      </h2>,
    )
    expect(container.querySelector('p, div, ul, ol')).toBeNull()
    expect(container.querySelector('h2 strong')).toHaveTextContent('Soup')
    expect(container.querySelector('h2')).toHaveTextContent('Soup of the day')
  })

  it('renders nothing for an empty node', () => {
    const node = nodeFrom(new Delta())
    const { container } = render(<RichTextView node={node} />)
    expect(container.innerHTML).toBe('')
  })
})
