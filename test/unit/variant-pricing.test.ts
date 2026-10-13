import { describe, expect, it } from 'vitest'
import {
  componentsToLines,
  findVariantByLabel,
  linesToComponents,
  pricePlanUnchanged,
  variantLabel
} from '../../shared/utils/variant-pricing'
import type { PriceLine, VertexProductRow } from '../../shared/types/vertex'

const BASE = 'fee_base_id'
const TAX = 'fee_tax_id'

const child = (label: string, id: string) => ({
  id,
  sku: id,
  axisValues: label.split(' / ').map((l, i) => ({ attributeLabel: i ? 'Validity' : 'Color', label: l }))
} as VertexProductRow)

const line = (feeItemId: string, amount: number, extra: Partial<PriceLine> = {}): PriceLine => ({
  id: 'l_' + feeItemId,
  lineType: 'fee',
  feeItemId,
  bundleSelectionId: null,
  amount,
  amountMonthly: null,
  isPublished: true,
  sortOrder: 0,
  feeCode: null,
  feeName: null,
  feeKind: null,
  ...extra
})

describe('variantLabel', () => {
  it('joins the axis labels the way the URL and the UI spell them', () => {
    expect(variantLabel([{ attributeLabel: 'Color', label: 'Black' }, { attributeLabel: 'Validity', label: '8 Days' }]))
      .toBe('Black / 8 Days')
  })

  it('survives a product with no axes', () => {
    expect(variantLabel([])).toBe('')
    expect(variantLabel(undefined)).toBe('')
  })
})

describe('findVariantByLabel', () => {
  const children = [child('Black / 8 Days', 'v1'), child('White / 16 Days', 'v2')]

  it('finds the child whose axes spell the label', () => {
    expect(findVariantByLabel(children, 'White / 16 Days')?.id).toBe('v2')
  })

  it('tolerates the surrounding whitespace a URL can carry', () => {
    expect(findVariantByLabel(children, '  Black / 8 Days ')?.id).toBe('v1')
  })

  it('returns null rather than the first child when nothing matches', () => {
    // the old page fell back to a demo record here, which showed one
    // product's data under another's name
    expect(findVariantByLabel(children, 'Red / 8 Days')).toBeNull()
    expect(findVariantByLabel([], 'Black / 8 Days')).toBeNull()
    expect(findVariantByLabel(null, 'Black / 8 Days')).toBeNull()
  })
})

describe('linesToComponents', () => {
  it('keeps the API order and carries the denormalised fee name through', () => {
    const comps = linesToComponents([
      line(TAX, 330, { sortOrder: 1, feeName: 'Tax', feeKind: 'tax' }),
      line(BASE, 3300, { sortOrder: 0, feeName: 'Base Price', feeKind: 'base' })
    ])

    expect(comps.map(c => c.feeItemId)).toEqual([BASE, TAX])
    expect(comps[0]!.label).toBe('Base Price')
    expect(comps[0]!.amount).toBe('3300')
  })

  it('ignores a selection line, which belongs to a bundle not a variant', () => {
    const comps = linesToComponents([
      line(BASE, 100),
      { ...line('x', 50), lineType: 'selection', feeItemId: null, bundleSelectionId: 's1' }
    ])
    expect(comps).toHaveLength(1)
  })

  it('reads an unpublished line as unpublished', () => {
    expect(linesToComponents([line(TAX, 10, { isPublished: false })])[0]!.isPublished).toBe(false)
  })
})

describe('componentsToLines', () => {
  const comp = (feeItemId: string, amount: string, isPublished = true) => ({ feeItemId, amount, isPublished })

  it('turns the typed strings into integer amounts', () => {
    expect(componentsToLines([comp(BASE, '3300'), comp(TAX, '330')], BASE)).toEqual([
      { lineType: 'fee', feeItemId: BASE, amount: 3300, isPublished: true },
      { lineType: 'fee', feeItemId: TAX, amount: 330, isPublished: true }
    ])
  })

  it('drops a blank non-base row rather than sending a zero nobody typed', () => {
    const lines = componentsToLines([comp(BASE, '3300'), comp(TAX, '')], BASE)
    expect(lines.map(l => l.feeItemId)).toEqual([BASE])
  })

  it('keeps the base row even when blank, because a plan must carry one', () => {
    // leaving it out is 422 `base_price_required`; zero is the honest reading
    // of an empty base field
    expect(componentsToLines([comp(BASE, '')], BASE)).toEqual([
      { lineType: 'fee', feeItemId: BASE, amount: 0, isPublished: true }
    ])
  })

  it('refuses a fractional amount rather than rounding into a price nobody chose', () => {
    // the API is integer JPY; 10.5 is a mistake, not a half-yen
    expect(componentsToLines([comp(BASE, '100'), comp(TAX, '10.5')], BASE).map(l => l.feeItemId))
      .toEqual([BASE])
  })

  it('carries the published flag through', () => {
    expect(componentsToLines([comp(BASE, '1'), comp(TAX, '2', false)], BASE)[1]!.isPublished).toBe(false)
  })
})

describe('pricePlanUnchanged', () => {
  const saved = [line(BASE, 3300, { sortOrder: 0 }), line(TAX, 330, { sortOrder: 1 })]

  it('is true when nothing about the prices moved', () => {
    // a save that only renamed the variant must not supersede the plan and
    // add a row to its price history
    const next = componentsToLines(
      [{ feeItemId: BASE, amount: '3300', isPublished: true }, { feeItemId: TAX, amount: '330', isPublished: true }],
      BASE
    )
    expect(pricePlanUnchanged(saved, next)).toBe(true)
  })

  it('ignores the order, which is not a price change', () => {
    const next = componentsToLines(
      [{ feeItemId: TAX, amount: '330', isPublished: true }, { feeItemId: BASE, amount: '3300', isPublished: true }],
      BASE
    )
    expect(pricePlanUnchanged(saved, next)).toBe(true)
  })

  it('is false when an amount, a line or a published flag changed', () => {
    const build = (comps: { feeItemId: string, amount: string, isPublished?: boolean }[]) =>
      componentsToLines(comps.map(c => ({ ...c, isPublished: c.isPublished !== false })), BASE)

    expect(pricePlanUnchanged(saved, build([{ feeItemId: BASE, amount: '3400' }, { feeItemId: TAX, amount: '330' }]))).toBe(false)
    expect(pricePlanUnchanged(saved, build([{ feeItemId: BASE, amount: '3300' }]))).toBe(false)
    expect(pricePlanUnchanged(saved, build([
      { feeItemId: BASE, amount: '3300' }, { feeItemId: TAX, amount: '330', isPublished: false }
    ]))).toBe(false)
  })

  it('treats no saved plan as a change, so the first price is written', () => {
    expect(pricePlanUnchanged(undefined, [{ lineType: 'fee', feeItemId: BASE, amount: 1, isPublished: true }])).toBe(false)
  })
})
