import { describe, expect, it } from 'vitest'
import { toStoredProduct, toStoredProducts } from '../../shared/utils/product-row'
import type { VertexProductRow } from '../../shared/types/vertex'

const row = (extra: Partial<VertexProductRow> = {}): VertexProductRow => ({
  id: 'p1',
  type: 'simple',
  status: 'active',
  name: 'Tourist SIM 15GB',
  nameSource: null,
  sku: 'TSIM-15GB',
  parent: null,
  axisValues: [],
  variantCount: null,
  platforms: [{ id: 'pf1', code: 'SKSIM', name: 'SK SIM' }, { id: 'pf2', code: 'SIMPOINT', name: 'SIM Point' }],
  categories: [{ id: 'c1', name: 'Tourist SIM', path: 'SIM Cards / Tourist SIM' }],
  categoriesSource: null,
  stockStatus: 'in_stock',
  stockStatusComputed: false,
  pricingSummary: { hasDefaultPrice: true, defaultInitialTotal: 4130, defaultMonthly: null, differsOnPlatforms: 0 },
  priceFrom: 4130,
  monthlyFrom: null,
  priceSource: null,
  priceDiffersOnPlatforms: 0,
  isNew: true,
  imageUrl: null,
  imagesSource: null,
  deletedAt: null,
  lockVersion: 2,
  updatedAt: '2026-10-07T14:33:14.373Z',
  ...extra
})

describe('toStoredProduct', () => {
  it('capitalises the status, because the screens compare against `Active`', () => {
    expect(toStoredProduct(row()).status).toBe('Active')
    expect(toStoredProduct(row({ status: 'inactive' })).status).toBe('Inactive')
    expect(toStoredProduct(row({ status: 'draft' })).status).toBe('Draft')
  })

  it('maps every product type to the older vocabulary', () => {
    expect(toStoredProduct(row({ type: 'simple' })).productType).toBe('single')
    expect(toStoredProduct(row({ type: 'configurable' })).productType).toBe('variant')
    expect(toStoredProduct(row({ type: 'bundle' })).productType).toBe('bundle')
  })

  it('derives hasVariants from the type rather than the count', () => {
    // a configurable with no variants yet is still a variant product
    expect(toStoredProduct(row({ type: 'configurable', variantCount: null })).hasVariants).toBe(true)
    expect(toStoredProduct(row({ type: 'bundle', variantCount: 3 })).hasVariants).toBe(false)
  })

  it('gives a missing variant count zero, not null', () => {
    expect(toStoredProduct(row({ variantCount: null })).variantCount).toBe(0)
    expect(toStoredProduct(row({ type: 'configurable', variantCount: 4 })).variantCount).toBe(4)
  })

  it('flattens the platform objects into the ids and names the screens read', () => {
    const p = toStoredProduct(row())
    expect(p.platformIds).toEqual(['pf1', 'pf2'])
    expect(p.platformNames).toEqual(['SK SIM', 'SIM Point'])
  })

  it('takes the first category, because these rows show one', () => {
    const p = toStoredProduct(row({
      categories: [
        { id: 'c1', name: 'Tourist SIM', path: 'SIM Cards / Tourist SIM' },
        { id: 'c2', name: 'eSIM', path: 'SIM Cards / eSIM' }
      ]
    }))
    expect(p.categoryId).toBe('c1')
    expect(p.categoryPath).toBe('SIM Cards / Tourist SIM')
  })

  it('leaves the category fields undefined when the product has none', () => {
    const p = toStoredProduct(row({ categories: [] }))
    expect(p.categoryId).toBeUndefined()
    expect(p.category).toBeUndefined()
  })

  it('survives a row with no platforms or categories arrays at all', () => {
    const bare = { id: 'x', type: 'simple', status: 'active', name: 'X', sku: 'X' } as VertexProductRow
    const p = toStoredProduct(bare)
    expect(p.platformIds).toEqual([])
    expect(p.platformNames).toEqual([])
  })

  it('carries isNew through rather than recomputing it from a timestamp', () => {
    expect(toStoredProduct(row({ isNew: false })).isNew).toBe(false)
  })

  it('turns the ISO timestamp into the epoch millis the screens compare', () => {
    const p = toStoredProduct(row())
    expect(p.createdAt).toBe(Date.parse('2026-10-07T14:33:14.373Z'))
  })

  it('maps a list', () => {
    expect(toStoredProducts([row(), row({ id: 'p2', name: 'Other' })]).map(p => p.id)).toEqual(['p1', 'p2'])
  })
})
