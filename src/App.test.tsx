import { fireEvent, render, screen } from '@testing-library/react'
import { act } from 'react'
import { describe, expect, it } from 'vitest'
import App from './App'
import { Counter } from './fluid/schema'

describe('App', () => {
  it('shows the current count from the tree', () => {
    render(<App counter={new Counter({ count: 42 })} />)
    expect(screen.getByText('42')).toBeInTheDocument()
  })

  it('clicking the +1 button increments the shown count', () => {
    render(<App counter={new Counter({ count: 0 })} />)
    fireEvent.click(screen.getByRole('button', { name: '+1' }))
    expect(screen.getByText('1')).toBeInTheDocument()
  })

  it('re-renders when the tree changes outside the button (remote edit)', () => {
    const counter = new Counter({ count: 0 })
    render(<App counter={counter} />)
    act(() => counter.increment())
    expect(screen.getByText('1')).toBeInTheDocument()
  })
})
