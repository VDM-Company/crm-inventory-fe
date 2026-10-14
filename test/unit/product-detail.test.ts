import { describe, expect, it } from 'vitest'
import {
  bundleSummary,
  detailPatch,
  hasChanges,
  isSellable,
  toDetailEditable,
  toDetailView
} from '../../shared/utils/product-detail'
import type { BundleOption, VertexProduct } from '../../shared/types/vertex'

const product = (extra: Partial<VertexProduct> = {}): VertexProduct => ({
  id: 'p1',
  type: 'simple',
  status: 'active',
  sku: 'TSIM-15GB',
  parentId: null,
  parent: null,
  name: { en: 'Tourist SIM 15GB' },
  nameEdited: false,
  description: { en: '15GB of data' },
  notes: 'Supplier note',
  isSubscription: false,
  isGift: false,
  requiresShipping: true,
  lockedFields: ['sku'],
  stockStatus: 'in_stock',
  stockStatusComputed: false,
  everOrdered: false,
  categories: [{ id: 'c1', name: 'Tourist SIM', path: 'SIM Cards / Tourist SIM' }],
  platforms: [{ id: 'pf1', code: 'SKSIM', name: 'SK SIM' }, { id: 'pf2', code: 'SIMPOINT', name: 'SIM Point' }],
  children: null,
  axisValues: [],
  variantAxes: [],
  attributes: [],
  bundleOptions: [],
  pricingSummary: { hasDefaultPrice: true, defaultInitialTotal: 4130, defaultMonthly: null, differsOnPlatforms: 0 },
  media: [],
  publishedAt: null,
  deletedAt: null,
  createdAt: '2026-10-07T00:00:00.000Z',
  updatedAt: '2026-10-07T00:00:00.000Z',
  lockVersion: 2,
  ...extra
})

describe('toDetailEditable', () => {
  it('resolves the locale maps and takes the single category the screen edits', () => {
    const e = toDetailEditable(product())
    expect(e.name).toBe('Tourist SIM 15GB')
    expect(e.description).toBe('15GB of data')
    expect(e.categoryId).toBe('c1')
    expect(e.platformIds).toEqual(['pf1', 'pf2'])
  })

  it('reads the API’s `isGift` as the screen’s "not for sale"', () => {
    expect(toDetailEditable(product({ isGift: true })).notForSale).toBe(true)
  })

  it('gives empty strings rather than undefined for the optional text', () => {
    const e = toDetailEditable(product({ notes: null, description: null }))
    expect(e.notes).toBe('')
    expect(e.description).toBe('')
  })

  it('survives a product with no categories or platforms', () => {
    const e = toDetailEditable(product({ categories: [], platforms: [] }))
    expect(e.categoryId).toBe('')
    expect(e.platformIds).toEqual([])
  })
})

describe('detailPatch', () => {
  const before = toDetailEditable(product())

  it('sends nothing when nothing changed', () => {
    const patch = detailPatch(before, { ...before })
    expect(patch).toEqual({})
    expect(hasChanges(patch)).toBe(false)
  })

  it('a rename sends the name and nothing else', () => {
    // the point: `sku` is refused once the product leaves Draft, so a patch
    // that resends every field would fail a save that only renamed it
    const patch = detailPatch(before, { ...before, name: 'Tourist SIM 20GB' })

    expect(patch).toEqual({ name: { en: 'Tourist SIM 20GB' } })
  })

  it('sends text fields as locale maps', () => {
    expect(detailPatch(before, { ...before, description: 'New copy' }).description)
      .toEqual({ en: 'New copy' })
  })

  it('clears a text field with null rather than an empty map', () => {
    const patch = detailPatch(before, { ...before, description: '', notes: '' })
    expect(patch.description).toBeNull()
    expect(patch.notes).toBeNull()
  })

  it('turns the one category the screen edits into the array the API takes', () => {
    expect(detailPatch(before, { ...before, categoryId: 'c2' }).categoryIds).toEqual(['c2'])
    expect(detailPatch(before, { ...before, categoryId: '' }).categoryIds).toEqual([])
  })

  it('ignores a reordering of the platforms, which is not a change', () => {
    expect(detailPatch(before, { ...before, platformIds: ['pf2', 'pf1'] })).toEqual({})
  })

  it('notices a platform added or removed', () => {
    expect(detailPatch(before, { ...before, platformIds: ['pf1'] }).platformIds).toEqual(['pf1'])
    expect(detailPatch(before, { ...before, platformIds: ['pf1', 'pf2', 'pf3'] }).platformIds)
      .toEqual(['pf1', 'pf2', 'pf3'])
  })

  it('maps "not for sale" onto isGift', () => {
    expect(detailPatch(before, { ...before, notForSale: true })).toEqual({ isGift: true })
  })

  it('collects several changes into one body', () => {
    const patch = detailPatch(before, { ...before, name: 'X', notes: 'Y', notForSale: true })
    expect(Object.keys(patch).sort()).toEqual(['isGift', 'name', 'notes'])
  })
})

describe('toDetailView attributes', () => {
  it('gives the editor the `{ name, values }` it reads, not the API wording', () => {
    // the editor calls `.values` and iterates it; handing it the API's
    // `{ label, display }` threw on the first Edit click
    const view = toDetailView(product({
      attributes: [{
        attributeId: 'a1', code: 'data', label: 'Data', inputType: 'dropdown',
        value: ['o1'], display: '15GB', source: 'product'
      }]
    }), null) as { attributes: { name: string, values: string[] }[] }

    expect(view.attributes).toEqual([{ name: 'Data', values: ['15GB'] }])
    expect(Array.isArray(view.attributes[0]!.values)).toBe(true)
  })

  it('gives an attribute with nothing resolved an empty array, not undefined', () => {
    const view = toDetailView(product({
      attributes: [{
        attributeId: 'a1', code: 'x', label: 'X', inputType: 'text',
        value: {}, display: '', source: 'product'
      }]
    }), null) as { attributes: { values: string[] }[] }

    expect(view.attributes[0]!.values).toEqual([])
  })
})

describe('isSellable', () => {
  it('says a configurable parent cannot hold its own price', () => {
    // the API answers 422 `not_sellable`; the prices belong to the variants
    expect(isSellable(product({ type: 'configurable' }))).toBe(false)
  })

  it('says a simple product and a bundle can', () => {
    expect(isSellable(product({ type: 'simple' }))).toBe(true)
    expect(isSellable(product({ type: 'bundle' }))).toBe(true)
  })

  it('is false with no product at all', () => {
    expect(isSellable(null)).toBe(false)
  })
})

describe('bundleSummary', () => {
  const options: BundleOption[] = [{
    id: 'o1',
    title: { en: 'SIM' },
    inputType: 'radio',
    isRequired: true,
    sortOrder: 0,
    selections: [
      { id: 's1', productId: 'p1', sku: 'TSIM-15GB', name: 'Tourist SIM 15GB', isDefault: true, maxQty: 1, isHidden: false, stockStatus: 'in_stock', sortOrder: 0 }
    ]
  }]

  it('flattens the options for display, keeping the selection ids', () => {
    // the ids matter even read-only: editing later must send them back or the
    // in-bundle prices are dropped
    const s = bundleSummary(options)
    expect(s[0]!.title).toBe('SIM')
    expect(s[0]!.products[0]).toMatchObject({ id: 's1', productId: 'p1', sku: 'TSIM-15GB' })
  })

  it('returns nothing for a product that is not a bundle', () => {
    expect(bundleSummary(undefined)).toEqual([])
    expect(bundleSummary([])).toEqual([])
  })
})
