import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CopyLink } from './CopyLink'

function stubClipboard() {
  const writeText = vi.fn(() => Promise.resolve())
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
  return writeText
}

describe('CopyLink', () => {
  afterEach(() => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true })
  })

  it('shows the link so it can be copied by hand', () => {
    render(<CopyLink label="Copy book link" url="http://x.test/#b/abc" />)
    expect(screen.getByRole('textbox', { name: /book link/i })).toHaveValue('http://x.test/#b/abc')
  })

  it('writes the link to the clipboard and confirms', async () => {
    const writeText = stubClipboard()
    render(<CopyLink label="Copy book link" url="http://x.test/#b/abc" />)
    fireEvent.click(screen.getByRole('button', { name: 'Copy book link' }))
    expect(writeText).toHaveBeenCalledWith('http://x.test/#b/abc')
    expect(await screen.findByRole('button', { name: /copied/i })).toBeInTheDocument()
  })

  it('still shows the link when the clipboard is unavailable', () => {
    render(<CopyLink label="Copy recipe link" url="http://x.test/#b/abc/r1" />)
    fireEvent.click(screen.getByRole('button', { name: 'Copy recipe link' }))
    expect(screen.getByRole('textbox', { name: /recipe link/i })).toHaveValue('http://x.test/#b/abc/r1')
  })
})
