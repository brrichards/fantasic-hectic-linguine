import { describe, expect, it } from 'vitest'
import { parseLineTag } from './quillAttributes'

describe('parseLineTag', () => {
  it('maps headers to h1..h5 and clamps larger headers to h5', () => {
    expect(parseLineTag({ header: 2 })?.value).toBe('h2')
    expect(parseLineTag({ header: 6 })?.value).toBe('h5')
  })
})
