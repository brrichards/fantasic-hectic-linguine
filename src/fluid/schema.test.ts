import { describe, expect, it } from 'vitest'
import { Counter } from './schema'

describe('Counter', () => {
  it('holds the count it was created with', () => {
    const counter = new Counter({ count: 5 })
    expect(counter.count).toBe(5)
  })

  it('increment adds 1 to the count', () => {
    const counter = new Counter({ count: 0 })
    counter.increment()
    expect(counter.count).toBe(1)
  })

  it('increment accumulates across repeated calls', () => {
    const counter = new Counter({ count: 10 })
    counter.increment()
    counter.increment()
    counter.increment()
    expect(counter.count).toBe(13)
  })
})
