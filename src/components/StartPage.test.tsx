import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { compactFromUuid } from '../ids'
import { StartPage } from './StartPage'

const uuid = '7a113933-fa9b-4f61-a04d-82d1807a191a'

function setup(props: Partial<Parameters<typeof StartPage>[0]> = {}) {
  const onOpen = vi.fn()
  const onCreate = vi.fn()
  const onForget = vi.fn()
  render(<StartPage remembered={[]} onOpen={onOpen} onCreate={onCreate} onForget={onForget} {...props} />)
  return { onOpen, onCreate, onForget }
}

function submit(label: string, value: string, button: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
  fireEvent.click(screen.getByRole('button', { name: button }))
}

describe('StartPage', () => {
  it('opens the book whose id is pasted, in compact or full form', () => {
    const { onOpen } = setup()
    submit('Book id', ` ${compactFromUuid(uuid)} `, 'Open')
    expect(onOpen).toHaveBeenLastCalledWith(uuid)
    submit('Book id', uuid, 'Open')
    expect(onOpen).toHaveBeenLastCalledWith(uuid)
  })

  it('creates a book with the typed name, trimmed', () => {
    const { onCreate } = setup()
    submit('Book name', '  Carol ', 'Create')
    expect(onCreate).toHaveBeenCalledExactlyOnceWith('Carol')
  })

  it('does nothing for a blank id or a blank name', () => {
    const { onOpen, onCreate } = setup()
    submit('Book id', '   ', 'Open')
    submit('Book name', '   ', 'Create')
    expect(onOpen).not.toHaveBeenCalled()
    expect(onCreate).not.toHaveBeenCalled()
  })

  it('lists the books this browser remembers, to open or to forget', () => {
    const { onOpen, onForget } = setup({
      remembered: [
        { name: 'Alice', bookId: 'book-a' },
        { name: 'Bob', bookId: 'book-b' },
      ],
    })
    const rows = screen.getAllByRole('listitem')
    expect(rows).toHaveLength(2)
    fireEvent.click(within(rows[1]).getByRole('button', { name: 'Bob' }))
    expect(onOpen).toHaveBeenCalledExactlyOnceWith('book-b')
    fireEvent.click(within(rows[0]).getByRole('button', { name: 'Forget Alice' }))
    expect(onForget).toHaveBeenCalledExactlyOnceWith('book-a')
  })

  it('shows no list when nothing is remembered', () => {
    setup()
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })

  it('shows why the last attempt failed', () => {
    setup({ error: 'That book could not be opened.' })
    expect(screen.getByRole('alert')).toHaveTextContent('That book could not be opened.')
  })

  it('takes no further requests while one is under way', () => {
    const { onOpen, onCreate, onForget } = setup({
      busy: true,
      remembered: [{ name: 'Alice', bookId: 'book-a' }],
    })
    for (const button of screen.getAllByRole('button')) expect(button).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Book name'), { target: { value: 'Carol' } })
    fireEvent.submit(screen.getByLabelText('Book name').closest('form')!)
    fireEvent.change(screen.getByLabelText('Book id'), { target: { value: 'book-a' } })
    fireEvent.submit(screen.getByLabelText('Book id').closest('form')!)
    expect(onCreate).not.toHaveBeenCalled()
    expect(onOpen).not.toHaveBeenCalled()
    expect(onForget).not.toHaveBeenCalled()
  })
})
