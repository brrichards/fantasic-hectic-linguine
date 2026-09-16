import Quill, { type EmitterSource } from 'quill'
import Delta from 'quill-delta'
import { useEffect, useRef } from 'react'
import 'quill/dist/quill.snow.css'
import type { RichText } from '../fluid/schema'
import { applyQuillDeltaToTree, buildDeltaFromTree, contentOpsToQuillDelta } from './quillBridge'
import './RichTextEditor.css'

export type RichTextVariant = 'prose' | 'line'

interface RichTextEditorProps {
  node: RichText
  /** `prose` shows a formatting toolbar and allows multiple lines; `line` is a single line with no toolbar. */
  variant: RichTextVariant
  placeholder?: string
}

const proseToolbar = [
  ['bold', 'italic', 'underline'],
  [{ header: [1, 2, 3, false] }],
  [{ list: 'bullet' }, { list: 'ordered' }],
  ['blockquote'],
  ['clean'],
]

/** Keyboard bindings that swallow Enter so the line variant never gains a second line. */
const singleLineBindings = {
  enter: { key: 'Enter', handler: () => false },
  shiftEnter: { key: 'Enter', shiftKey: true, handler: () => false },
}

function stripNewlines(delta: Delta): Delta {
  const ops = delta.ops.map((op) =>
    typeof op.insert === 'string' ? { ...op, insert: op.insert.replace(/\n/g, '') } : op,
  )
  return new Delta(ops.filter((op) => op.insert !== ''))
}

function deltaHasNewline(delta: Delta): boolean {
  return delta.ops.some((op) => typeof op.insert === 'string' && op.insert.includes('\n'))
}

/** Brings the editor back in line with the tree when incremental ops are unavailable. */
function resync(quill: Quill, node: RichText): void {
  const diff = quill.getContents().diff(new Delta(buildDeltaFromTree(node)))
  if (diff.ops.length > 0) quill.updateContents(diff, 'api')
}

/**
 * A Quill editor bound to one FormattedText node. Local edits flow into the
 * tree as transactions; tree changes, local or remote, flow back into Quill.
 * A re-entrancy flag stops each direction from echoing into the other.
 */
export function RichTextEditor({ node, variant, placeholder }: RichTextEditorProps) {
  const hostRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const isLine = variant === 'line'
    const quill = new Quill(host, {
      theme: 'snow',
      placeholder,
      modules: {
        history: false,
        toolbar: isLine ? false : proseToolbar,
        ...(isLine ? { keyboard: { bindings: singleLineBindings } } : {}),
      },
    })
    quill.setContents(buildDeltaFromTree(node), 'api')

    let updating = false
    const guarded = (fn: () => void) => {
      if (updating) return
      updating = true
      try {
        fn()
      } finally {
        updating = false
      }
    }

    const onTextChange = (delta: Delta, _old: Delta, source: EmitterSource) => {
      if (source !== 'user') return
      guarded(() => {
        if (isLine && deltaHasNewline(delta)) {
          applyQuillDeltaToTree(node, stripNewlines(delta))
          resync(quill, node)
        } else {
          applyQuillDeltaToTree(node, delta)
        }
      })
    }
    quill.on('text-change', onTextChange)

    const unsubscribe = node.onContentChanged((ops) => {
      guarded(() => {
        const quillOps = ops === undefined ? undefined : contentOpsToQuillDelta(node, ops, quill.getText())
        if (quillOps === undefined) {
          resync(quill, node)
        } else if (quillOps.length > 0) {
          quill.updateContents(quillOps, 'api')
        }
      })
    })

    return () => {
      unsubscribe()
      quill.off('text-change', onTextChange)
      const toolbar = quill.getModule('toolbar') as { container?: HTMLElement } | undefined
      toolbar?.container?.remove()
      host.className = ''
      host.innerHTML = ''
    }
  }, [node, variant, placeholder])

  return (
    <div className={`rich-text rich-text-${variant}`}>
      <div ref={hostRef} />
    </div>
  )
}
