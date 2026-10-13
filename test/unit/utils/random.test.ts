import { describe, expect, it, vi } from 'vitest'
import { randomFrom, randomInt } from '../../../app/utils/index'

describe('randomInt', () => {
  it('includes both ends of the range', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    expect(randomInt(1, 5)).toBe(1)

    vi.spyOn(Math, 'random').mockReturnValue(0.9999999)
    expect(randomInt(1, 5)).toBe(5)

    vi.restoreAllMocks()
  })

  it('stays inside the range over many draws', () => {
    for (let i = 0; i < 200; i++) {
      const n = randomInt(3, 7)
      expect(n).toBeGreaterThanOrEqual(3)
      expect(n).toBeLessThanOrEqual(7)
      expect(Number.isInteger(n)).toBe(true)
    }
  })

  it('handles a single-value range', () => {
    expect(randomInt(4, 4)).toBe(4)
  })
})

describe('randomFrom', () => {
  it('can return the first and the last element', () => {
    const items = ['a', 'b', 'c']

    vi.spyOn(Math, 'random').mockReturnValue(0)
    expect(randomFrom(items)).toBe('a')

    vi.spyOn(Math, 'random').mockReturnValue(0.9999999)
    expect(randomFrom(items)).toBe('c')

    vi.restoreAllMocks()
  })

  it('only ever returns a member of the array', () => {
    const items = [1, 2, 3, 4]
    for (let i = 0; i < 100; i++) expect(items).toContain(randomFrom(items))
  })
})
