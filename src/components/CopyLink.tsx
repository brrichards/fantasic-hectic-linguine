import { useEffect, useState } from 'react'

interface CopyLinkProps {
  /** Button text, e.g. "Copy book link". The visible link is labelled by the rest of it. */
  label: string
  url: string
}

/** A link shown in a read-only field with a button that copies it. */
export function CopyLink({ label, url }: CopyLinkProps) {
  const [copied, setCopied] = useState(false)
  const fieldLabel = label.replace(/^copy\s+/i, '')
  const fieldName = fieldLabel.charAt(0).toUpperCase() + fieldLabel.slice(1)

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(timer)
  }, [copied])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
    } catch {
      // No clipboard access: the field is there to copy by hand.
    }
  }

  return (
    <span className="copy-link">
      <input aria-label={fieldName} readOnly value={url} onFocus={(e) => e.target.select()} />
      <button type="button" onClick={() => void copy()}>
        {copied ? 'Copied' : label}
      </button>
    </span>
  )
}
