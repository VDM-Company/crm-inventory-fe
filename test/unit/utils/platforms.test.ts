import { describe, expect, it } from 'vitest'
import { platformById, platformSlug } from '../../../app/utils/platforms'
import type { Platform } from '../../../shared/types/domain'

const platforms: Platform[] = [
  { id: 'p_sp', name: 'SIM Point', code: 'sim_point', url: 'vdm.com/sp-sim' },
  { id: 'p_sk', name: 'SK-SIM', code: 'sk_sim', url: 'vdm.com/sk-sim' }
]

describe('platformById', () => {
  it('finds a platform, and returns null when it is missing', () => {
    expect(platformById(platforms, 'p_sk')?.name).toBe('SK-SIM')
    expect(platformById(platforms, 'nope')).toBeNull()
  })
})

describe('platformSlug', () => {
  it('writes the code the way the API does: uppercase, no separators', () => {
    // `SKSIM`, `SIMPOINT`, `OLDSTORE` upstream — not the `sim_point` the
    // placeholder used
    expect(platformSlug('SIM Point')).toBe('SIMPOINT')
    expect(platformSlug('SK-SIM')).toBe('SKSIM')
    expect(platformSlug('Old Store')).toBe('OLDSTORE')
  })

  it('drops punctuation rather than turning it into separators', () => {
    expect(platformSlug('Vertex  --  Digital')).toBe('VERTEXDIGITAL')
    expect(platformSlug('  Hello World!  ')).toBe('HELLOWORLD')
  })

  it('keeps digits', () => {
    expect(platformSlug('Store 2')).toBe('STORE2')
  })

  it('survives a name with nothing usable in it', () => {
    expect(platformSlug('')).toBe('')
    expect(platformSlug('---')).toBe('')
  })

  it('stays within a length the API will accept', () => {
    expect(platformSlug('x'.repeat(100))).toHaveLength(32)
  })
})
