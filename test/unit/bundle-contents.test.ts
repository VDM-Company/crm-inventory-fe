import { describe, expect, it } from 'vitest'
import {
  bundleBlockedReason,
  bundleChanged,
  bundleRemovals,
  toBundleDraft,
  toBundleEditor
} from '../../shared/utils/bundle-contents'
import type { BundleOption } from '../../shared/types/vertex'

const option = (over: Partial<BundleOption> = {}): BundleOption => ({
  id: 'opt_sim',
  title: { en: 'SIM' },
  inputType: 'radio',
  isRequired: true,
  sortOrder: 0,
  selections: [
    {
      id: 'sel_tsim',
      productId: 'p_tsim',
      sku: 'TSIM-15GB',
      name: 'Tourist SIM 15GB',
      isDefault: true,
      maxQty: 1,
      isHidden: false,
      stockStatus: 'in_stock',
      sortOrder: 0
    }
  ],
  ...over
})

describe('toBundleEditor', () => {
  it('keeps every id, which is what the in-bundle prices hang off', () => {
    const [row] = toBundleEditor([option()])
    expect(row!.id).toBe('opt_sim')
    expect(row!.selections[0]!.id).toBe('sel_tsim')
  })

  it('reads the localized title as text', () => {
    expect(toBundleEditor([option()])[0]!.title).toBe('SIM')
  })

  it('handles an empty or missing list', () => {
    expect(toBundleEditor([])).toEqual([])
    expect(toBundleEditor(null)).toEqual([])
  })
})

describe('toBundleDraft', () => {
  it('sends every id it was given', () => {
    // without them the API treats each selection as new and the in-bundle
    // price set for it is gone — silently, with a 200
    const draft = toBundleDraft(toBundleEditor([option()]))
    expect(draft.options[0]).toMatchObject({ id: 'opt_sim', title: { en: 'SIM' } })
    expect(draft.options[0]!.selections[0]).toMatchObject({ id: 'sel_tsim', productId: 'p_tsim' })
  })

  it('omits the id on a row added in this session', () => {
    const rows = toBundleEditor([option()])
    rows[0]!.selections.push({ productId: 'p_new', name: 'New', sku: 'NEW', isDefault: false, maxQty: 1 })
    const sent = toBundleDraft(rows).options[0]!.selections
    expect(sent[0]).toHaveProperty('id')
    expect(sent[1]).not.toHaveProperty('id')
  })

  it('drops an option with no title or no product rather than sending a 422', () => {
    const rows = toBundleEditor([option()])
    rows.push({ key: 'new:1', title: '', inputType: 'radio', isRequired: true, selections: [] })
    rows.push({ key: 'new:2', title: 'Empty', inputType: 'radio', isRequired: true, selections: [] })
    expect(toBundleDraft(rows).options).toHaveLength(1)
  })

  it('carries lockVersion only when it is given one', () => {
    expect(toBundleDraft([], 4).lockVersion).toBe(4)
    expect(toBundleDraft([])).not.toHaveProperty('lockVersion')
  })
})

describe('bundleRemovals', () => {
  const before = toBundleEditor([
    option(),
    option({
      id: 'opt_wifi',
      title: { en: 'WiFi' },
      selections: [
        { id: 'sel_a', productId: 'p_a', sku: 'A', name: 'WiFi A', isDefault: true, maxQty: 1, isHidden: false, stockStatus: 'in_stock', sortOrder: 0 },
        { id: 'sel_b', productId: 'p_b', sku: 'B', name: 'WiFi B', isDefault: false, maxQty: 1, isHidden: false, stockStatus: 'in_stock', sortOrder: 1 }
      ]
    })
  ])

  it('reports a selection that is going, and what it was', () => {
    const after = JSON.parse(JSON.stringify(before))
    after[1].selections = [after[1].selections[0]]
    expect(bundleRemovals(before, after)).toEqual([
      { kind: 'selection', label: 'WiFi — WiFi B', sku: 'B' }
    ])
  })

  it('reports a whole option going, without listing each of its selections', () => {
    // one line reads better than three for the same fact
    const after = [before[0]!]
    expect(bundleRemovals(before, after)).toEqual([{ kind: 'option', label: 'WiFi' }])
  })

  it('ignores a row added and dropped in the same session', () => {
    // it never had an id, so there is no price to lose
    const after = JSON.parse(JSON.stringify(before))
    after[0].selections.push({ productId: 'p_tmp', name: 'Temp', sku: 'T', isDefault: false, maxQty: 1 })
    expect(bundleRemovals(before, JSON.parse(JSON.stringify(before)))).toEqual([])
    expect(bundleRemovals(after, before)).toEqual([])
  })

  it('is empty when nothing was removed', () => {
    expect(bundleRemovals(before, JSON.parse(JSON.stringify(before)))).toEqual([])
  })
})

describe('bundleBlockedReason', () => {
  const rows = () => toBundleEditor([option()])

  it('allows a valid bundle', () => {
    expect(bundleBlockedReason(rows())).toBeNull()
  })

  it('refuses a bundle with no components', () => {
    expect(bundleBlockedReason([])).toContain('at least one component')
  })

  it('refuses a component with no products', () => {
    // 422 `option_required`
    const r = rows()
    r[0]!.selections = []
    expect(bundleBlockedReason(r)).toContain('no products')
  })

  it('refuses the same product listed twice in one component', () => {
    // 422 `duplicate_product`
    const r = rows()
    r[0]!.selections.push({ productId: 'p_tsim', name: 'Again', sku: 'X', isDefault: false, maxQty: 1 })
    expect(bundleBlockedReason(r)).toContain('twice')
  })

  it('refuses two defaults where the customer picks one', () => {
    // 422 `default_conflict`
    const r = rows()
    r[0]!.selections.push({ productId: 'p_other', name: 'Other', sku: 'O', isDefault: true, maxQty: 1 })
    expect(bundleBlockedReason(r)).toContain('only one product can be the default')
  })

  it('allows two defaults where the customer picks several', () => {
    const r = rows()
    r[0]!.inputType = 'checkbox'
    r[0]!.selections.push({ productId: 'p_other', name: 'Other', sku: 'O', isDefault: true, maxQty: 1 })
    expect(bundleBlockedReason(r)).toBeNull()
  })

  it('refuses two components with the same name', () => {
    const r = [...rows(), ...rows().map(o => ({ ...o, id: 'opt_two', key: 'opt_two' }))]
    expect(bundleBlockedReason(r)).toContain('same name')
  })
})

describe('bundleChanged', () => {
  it('is false for an untouched copy', () => {
    const before = toBundleEditor([option()])
    expect(bundleChanged(before, JSON.parse(JSON.stringify(before)))).toBe(false)
  })

  it('sees a default move, a product swap and a title edit', () => {
    const before = toBundleEditor([option()])
    const flip = JSON.parse(JSON.stringify(before))
    flip[0].selections[0].isDefault = false
    const swap = JSON.parse(JSON.stringify(before))
    swap[0].selections[0].productId = 'p_other'
    const retitle = JSON.parse(JSON.stringify(before))
    retitle[0].title = 'SIM card'
    expect(bundleChanged(before, flip)).toBe(true)
    expect(bundleChanged(before, swap)).toBe(true)
    expect(bundleChanged(before, retitle)).toBe(true)
  })

  it('ignores a half-typed row with no product yet', () => {
    const before = toBundleEditor([option()])
    const after = JSON.parse(JSON.stringify(before))
    after[0].selections.push({ productId: '', name: '', sku: '', isDefault: false, maxQty: 1 })
    expect(bundleChanged(before, after)).toBe(false)
  })
})
