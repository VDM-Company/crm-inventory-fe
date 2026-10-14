import { describe, expect, it } from 'vitest'
import { toProductVariant, toProductVariants, toStoredProduct, toStoredProducts } from '../../shared/utils/product-row'
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

// ── variants ────────────────────────────────────────────────────────────────
// The Dashboard used to invent these from `variantCount` — `<product> —
// Variant 1`, a SKU with a number glued on, blank price and stock — and
// render them beside real records. They are fetched now, and folded here so
// Product Detail and the Dashboard cannot drift apart.

describe('toProductVariant', () => {
  const child = (extra: Partial<VertexProductRow> = {}) => row({
    id: 'v1',
    name: 'Pocket WiFi Router X1 - Black - 8 Days',
    sku: 'WIFI-X1-BLK-8D',
    axisValues: [
      { attributeLabel: 'Color', label: 'Black' },
      { attributeLabel: 'Validity', label: '8 Days' }
    ],
    priceFrom: 4400,
    stockStatus: 'in_stock',
    status: 'active',
    imageUrl: null,
    ...extra
  } as Partial<VertexProductRow>)

  it('names a variant by its axis values, not its full product name', () => {
    // every screen calls it `Black / 8 Days`
    expect(toProductVariant(child()).name).toBe('Black / 8 Days')
  })

  it('carries the id, which is what the row links by', () => {
    expect(toProductVariant(child()).id).toBe('v1')
  })

  it('falls back to the product name when it has no axis values', () => {
    // a child without them would otherwise render as an empty row
    expect(toProductVariant(child({ axisValues: [] })).name).toBe('Pocket WiFi Router X1 - Black - 8 Days')
  })

  it('reads an absent price as blank rather than "null"', () => {
    expect(toProductVariant(child({ priceFrom: null })).price).toBe('')
    expect(toProductVariant(child({ priceFrom: 0 })).price).toBe('0')
  })

  it('maps status onto the boolean the table renders', () => {
    expect(toProductVariant(child({ status: 'active' })).active).toBe(true)
    expect(toProductVariant(child({ status: 'inactive' })).active).toBe(false)
    expect(toProductVariant(child({ status: 'draft' })).active).toBe(false)
  })

  it('handles an empty or missing list', () => {
    expect(toProductVariants([])).toEqual([])
    expect(toProductVariants(null)).toEqual([])
    expect(toProductVariants(undefined)).toEqual([])
  })
})
