import { describe, expect, it } from 'vitest'
import { platformAssignedCount, platformById, platformSlug } from '../../../app/utils/platforms'
import type { Platform, StoredProduct } from '../../../shared/types/domain'

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
  it('lowercases and joins words with underscores', () => {
    expect(platformSlug('SIM Point')).toBe('sim_point')
    expect(platformSlug('SK-SIM')).toBe('sk_sim')
  })

  it('collapses runs of punctuation rather than leaving doubles', () => {
    expect(platformSlug('Vertex  --  Digital')).toBe('vertex_digital')
  })

  it('trims the separators it would otherwise leave at the ends', () => {
    expect(platformSlug('  Hello World!  ')).toBe('hello_world')
    expect(platformSlug('---')).toBe('')
  })

  it('survives an empty name', () => {
    expect(platformSlug('')).toBe('')
  })
})

describe('platformAssignedCount', () => {
  const product = (id: string, platformIds: string[]): StoredProduct => ({
    id,
    name: id,
    sku: id,
    status: 'Active',
    productType: 'single',
    hasVariants: false,
    variantCount: 0,
    platformIds
  })

  it('counts the products assigned to the platform', () => {
    const products = [product('p1', ['p_sp', 'p_sk']), product('p2', ['p_sp'])]
    expect(platformAssignedCount(products, 'p_sp')).toBe(2)
    expect(platformAssignedCount(products, 'p_sk')).toBe(1)
    expect(platformAssignedCount(products, 'p_general')).toBe(0)
  })

  it('ignores products whose platform list is missing', () => {
    const bare = { ...product('p3', []), platformIds: undefined as unknown as string[] }
    expect(platformAssignedCount([bare], 'p_sp')).toBe(0)
  })
})
