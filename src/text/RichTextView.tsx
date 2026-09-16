import type { Op } from 'quill-delta'
import { Fragment, type ReactNode } from 'react'
import type { RichText } from '../fluid/schema'
import { useNode } from '../hooks/useNode'
import { buildDeltaFromTree } from './quillBridge'
import './RichTextView.css'

interface RichTextViewProps {
  node: RichText
  /** Renders just the formatted characters, for use inside a heading or a list item. */
  inline?: boolean
}

interface Segment {
  text: string
  bold: boolean
  italic: boolean
  underline: boolean
}

/** One line of the document with the attributes Quill puts on its newline. */
interface Line {
  segments: Segment[]
  attributes: Record<string, unknown>
}

function splitLines(ops: Op[]): Line[] {
  const lines: Line[] = []
  let current: Segment[] = []
  for (const op of ops) {
    if (typeof op.insert !== 'string') continue
    const attributes = op.attributes ?? {}
    const parts = op.insert.split('\n')
    parts.forEach((part, index) => {
      if (part !== '') {
        current.push({
          text: part,
          bold: attributes.bold === true,
          italic: attributes.italic === true,
          underline: attributes.underline === true,
        })
      }
      if (index < parts.length - 1) {
        lines.push({ segments: current, attributes })
        current = []
      }
    })
  }
  if (current.length > 0) lines.push({ segments: current, attributes: {} })
  while (lines.length > 0 && isBlankParagraph(lines[lines.length - 1])) lines.pop()
  return lines
}

function isBlankParagraph(line: Line): boolean {
  return line.segments.length === 0 && blockKind(line) === 'paragraph'
}

type BlockKind = 'paragraph' | 'header' | 'bullet' | 'ordered' | 'blockquote'

function blockKind(line: Line): BlockKind {
  const { attributes } = line
  if (typeof attributes.header === 'number') return 'header'
  if (attributes.list === 'bullet') return 'bullet'
  if (attributes.list === 'ordered') return 'ordered'
  if (attributes.blockquote === true) return 'blockquote'
  return 'paragraph'
}

function renderSegments(segments: Segment[]): ReactNode {
  return segments.map((segment, index) => {
    let content: ReactNode = segment.text
    if (segment.underline) content = <u>{content}</u>
    if (segment.italic) content = <em>{content}</em>
    if (segment.bold) content = <strong>{content}</strong>
    return <Fragment key={index}>{content}</Fragment>
  })
}

const headingTags = ['h1', 'h2', 'h3', 'h4', 'h5'] as const

function renderBlocks(lines: Line[]): ReactNode[] {
  const blocks: ReactNode[] = []
  let index = 0
  while (index < lines.length) {
    const line = lines[index]
    const kind = blockKind(line)
    if (kind === 'bullet' || kind === 'ordered') {
      const run: Line[] = []
      while (index < lines.length && blockKind(lines[index]) === kind) run.push(lines[index++])
      blocks.push(renderRun(kind, run, blocks.length))
      continue
    }
    const key = blocks.length
    const content = line.segments.length > 0 ? renderSegments(line.segments) : <br />
    if (kind === 'header') {
      const level = Math.min(Math.max(Number(line.attributes.header), 1), headingTags.length)
      const Tag = headingTags[level - 1]
      blocks.push(<Tag key={key}>{content}</Tag>)
    } else if (kind === 'blockquote') {
      blocks.push(<blockquote key={key}>{content}</blockquote>)
    } else {
      blocks.push(<p key={key}>{content}</p>)
    }
    index += 1
  }
  return blocks
}

function renderRun(kind: 'bullet' | 'ordered', run: Line[], key: number): ReactNode {
  const items = run.map((line, index) => <li key={index}>{renderSegments(line.segments)}</li>)
  if (kind === 'ordered') return <ol key={key}>{items}</ol>
  return <ul key={key}>{items}</ul>
}

/** Renders a rich text node as plain HTML elements, following the node as it changes. */
export function RichTextView({ node, inline = false }: RichTextViewProps) {
  useNode(node, 'treeChanged')
  const lines = splitLines(buildDeltaFromTree(node))
  if (inline) return <>{renderSegments(lines.flatMap((line) => line.segments))}</>
  if (lines.length === 0) return null
  return <div className="rich-text-view">{renderBlocks(lines)}</div>
}
