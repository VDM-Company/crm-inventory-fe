import { describe, expect, it } from 'vitest'
import type { CreateFormInput } from '../../shared/utils/product-create'
import {
  resolveAxes,
  resolveCombinations,
  toApiProductType,
  toApiStockStatus,
  toBundleOptionsDraft,
  toProductDraft
} from '../../shared/utils/product-create'
import { toVertex } from '../../shared/utils/vertex-wire'
import type { Attribute } from '../../shared/types/vertex'

const CATEGORY = '01a116c8-5f68-737f-8e64-ca7edc41f65a'
const PLATFORMS = [
  '01a116c8-5d68-7007-a79d-4f65f606f29c',
  '01a116c8-5d82-73e5-9f80-a0e0cc8d42c5',
  '01a116c8-5da4-701e-b27e-4f7957b9338d'
]

const COLOR = '01a116c8-5eb3-71b2-b4b5-618a20332350'
const BLACK = '01a116c8-5eb4-7346-9a97-faf7cd69fc17'
const WHITE = '01a116c8-5eb4-7346-9a97-faf7cd2ceb95'
const VALIDITY = '01a116c8-5e73-73d7-a7a7-36866640010c'
const D8 = '01a116c8-5e75-736e-9d62-35de415780e6'
const D16 = '01a116c8-5e75-736e-9d62-35de41bbc24a'

const attribute = (id: string, label: string, options: [string, string][]): Attribute => ({
  id,
  code: label.toLowerCase(),
  label: { en: label },
  inputType: 'dropdown',
  isFilterable: true,
  canBeVariantAxis: true,
  options: options.map(([oid, olabel], i) => ({
    id: oid,
    code: olabel.toLowerCase(),
    label: { en: olabel },
    sortOrder: i,
    usageCount: 0
  })),
  sortOrder: 0,
  usageCount: 0,
  lockVersion: 1
})

const ATTRIBUTES: Attribute[] = [
  attribute(COLOR, 'Color', [[BLACK, 'Black'], [WHITE, 'White']]),
  attribute(VALIDITY, 'Validity', [[D8, '8 Days'], [D16, '16 Days']])
]

const form = (over: Partial<CreateFormInput> = {}): CreateFormInput => ({
  name: 'Tourist SIM 15GB',
  sku: 'TSIM-15GB',
  notes: 'Supplier: docomo MVNO, cartons of 50',
  description: '15GB of 4G/5G data for 8 days.',
  categoryId: CATEGORY,
  platformIds: PLATFORMS,
  productType: 'single',
  stock: 'in_stock',
  isSubscription: false,
  notForSale: false,
  ...over
})

describe('toApiStockStatus', () => {
  it('passes in_stock through and expands out_stock', () => {
    expect(toApiStockStatus('in_stock')).toBe('in_stock')
    expect(toApiStockStatus('out_stock')).toBe('out_of_stock')
  })
})

describe('toApiProductType', () => {
  it('translates the screen’s words into the API’s', () => {
    // the screen says single/variant/bundle; the API says
    // simple/configurable/bundle, and only `bundle` is the same word
    expect(toApiProductType('single')).toBe('simple')
    expect(toApiProductType('variant')).toBe('configurable')
    expect(toApiProductType('bundle')).toBe('bundle')
  })
})

describe('toProductDraft', () => {
  it('produces the collection’s own create body once cased for the wire', () => {
    // The mock answers 201 to any body at all, so this fixture is the only
    // thing standing between a renamed key and a silent data loss.
    const wire = toVertex(toProductDraft(form())) as Record<string, unknown>

    expect(wire).toMatchObject({
      type: 'simple',
      name: { en: 'Tourist SIM 15GB' },
      sku: 'TSIM-15GB',
      description: { en: '15GB of 4G/5G data for 8 days.' },
      notes: 'Supplier: docomo MVNO, cartons of 50',
      category_ids: [CATEGORY],
      platform_ids: PLATFORMS,
      is_subscription: false,
      is_gift: false,
      stock_status: 'in_stock'
    })
  })

  it('never sends a status, because only `draft` is accepted and it is the default', () => {
    expect(toProductDraft(form())).not.toHaveProperty('status')
  })

  it('sends the Not-for-sale switch as isGift', () => {
    expect(toProductDraft(form({ notForSale: true })).isGift).toBe(true)
  })

  it('leaves blank optional fields out rather than sending empty strings', () => {
    const draft = toProductDraft(form({ sku: '  ', notes: '', description: '', categoryId: '', platformIds: [] }))
    expect(draft).not.toHaveProperty('sku')
    expect(draft).not.toHaveProperty('notes')
    expect(draft).not.toHaveProperty('description')
    expect(draft).not.toHaveProperty('categoryIds')
    expect(draft).not.toHaveProperty('platformIds')
  })

  it('names an unnamed product rather than failing validation on name.en', () => {
    expect(toProductDraft(form({ name: '   ' })).name).toEqual({ en: 'Untitled Product' })
  })

  it('carries the variant matrix inline on a configurable product', () => {
    const draft = toProductDraft(form({ productType: 'variant' }), {
      axes: [{ attributeId: COLOR, optionIds: [BLACK, WHITE] }],
      combinations: [{ optionIds: [BLACK] }, { optionIds: [WHITE], sku: 'TSIM-W' }]
    })
    expect(draft.type).toBe('configurable')
    // `combinations`, not `variants` — the API names its errors
    // `variants.combinations.{i}.sku`
    expect(toVertex(draft)).toMatchObject({
      variants: {
        axes: [{ attribute_id: COLOR, option_ids: [BLACK, WHITE] }],
        combinations: [{ option_ids: [BLACK] }, { option_ids: [WHITE], sku: 'TSIM-W' }]
      }
    })
  })

  it('sends no variants block when there are no axes', () => {
    expect(toProductDraft(form({ productType: 'variant' }), { axes: [] })).not.toHaveProperty('variants')
    expect(toProductDraft(form({ productType: 'variant' }))).not.toHaveProperty('variants')
  })

  it('does not put the axis attributes in `attributes`', () => {
    // they describe the matrix, not this product's own values; sending them
    // both ways would give the parent values it does not have
    const draft = toProductDraft(form({ productType: 'variant' }), {
      axes: [{ attributeId: COLOR, optionIds: [BLACK] }]
    })
    expect(draft).not.toHaveProperty('attributes')
  })
})

describe('toProductDraft, stock', () => {
  it('sends the API\u2019s word for out of stock, not the form\u2019s', () => {
    // the form has said `out_stock` since the design; it is a string value,
    // so nothing in the case mapper would ever correct it
    expect(toProductDraft(form({ stock: 'out_stock' })).stockStatus).toBe('out_of_stock')
  })

  it('leaves the field off a configurable parent, which computes it', () => {
    // 422 `stock_status_computed`
    expect(toProductDraft(form({ productType: 'variant', stock: 'in_stock' }))).not.toHaveProperty('stockStatus')
  })
})

describe('resolveAxes', () => {
  it('turns labels into the attribute and option ids', () => {
    const { axes, unresolved } = resolveAxes(ATTRIBUTES, [
      { name: 'Color', values: ['Black', 'White'] },
      { name: 'Validity', values: ['8 Days'] }
    ])
    expect(unresolved).toEqual([])
    expect(axes).toEqual([
      { attributeId: COLOR, optionIds: [BLACK, WHITE] },
      { attributeId: VALIDITY, optionIds: [D8] }
    ])
  })

  it('skips rows the form has not filled in', () => {
    expect(resolveAxes(ATTRIBUTES, [{ name: '', values: [] }, { name: 'Color', values: [] }]).axes).toEqual([])
  })

  it('reports an attribute it has no id for instead of dropping the axis', () => {
    const { axes, unresolved } = resolveAxes(ATTRIBUTES, [{ name: 'Network', values: ['docomo'] }])
    expect(axes).toEqual([])
    expect(unresolved).toEqual(['Network'])
  })

  it('reports a value it has no option id for', () => {
    const { axes, unresolved } = resolveAxes(ATTRIBUTES, [{ name: 'Color', values: ['Black', 'Teal'] }])
    expect(unresolved).toEqual(['Color / Teal'])
    // the resolvable part is still reported, so the page can say what it has
    expect(axes).toEqual([{ attributeId: COLOR, optionIds: [BLACK] }])
  })
})

describe('resolveCombinations', () => {
  const axes = [
    { attributeId: COLOR, optionIds: [BLACK, WHITE] },
    { attributeId: VALIDITY, optionIds: [D8, D16] }
  ]

  it('turns a row key back into option ids in axis order', () => {
    const { combinations, unresolved } = resolveCombinations(ATTRIBUTES, axes, [
      { key: 'Black / 8 Days', sku: '' },
      { key: 'White / 16 Days', sku: 'WIFI-X1-16D-WHT' }
    ])
    expect(unresolved).toEqual([])
    expect(combinations).toEqual([
      { optionIds: [BLACK, D8] },
      { optionIds: [WHITE, D16], sku: 'WIFI-X1-16D-WHT' }
    ])
  })

  it('leaves the SKU out when the row has none, so the API generates one', () => {
    expect(resolveCombinations(ATTRIBUTES, axes, [{ key: 'Black / 8 Days', sku: '  ' }]).combinations[0])
      .not.toHaveProperty('sku')
  })

  it('reports a row whose labels do not resolve rather than creating a different variant', () => {
    const { combinations, unresolved } = resolveCombinations(ATTRIBUTES, axes, [
      { key: 'Black / 8 Days', sku: '' },
      { key: 'Teal / 8 Days', sku: '' }
    ])
    expect(combinations).toHaveLength(1)
    expect(unresolved).toEqual(['Teal / 8 Days'])
  })

  it('reports a row that does not have one label per axis', () => {
    expect(resolveCombinations(ATTRIBUTES, axes, [{ key: 'Black', sku: '' }]).unresolved).toEqual(['Black'])
  })

  it('resolves each label against its own axis, not against all of them', () => {
    // 'Black' belongs to Color; a label of the same name on another axis must
    // not be able to answer for it
    const shared: Attribute[] = [
      attribute(COLOR, 'Color', [[BLACK, 'Black']]),
      attribute(VALIDITY, 'Validity', [[D8, 'Black']])
    ]
    const twoAxes = [
      { attributeId: COLOR, optionIds: [BLACK] },
      { attributeId: VALIDITY, optionIds: [D8] }
    ]
    expect(resolveCombinations(shared, twoAxes, [{ key: 'Black / Black', sku: '' }]).combinations)
      .toEqual([{ optionIds: [BLACK, D8] }])
  })
})

describe('toBundleOptionsDraft', () => {
  it('builds the collection’s bundle-options body', () => {
    const wire = toVertex(toBundleOptionsDraft([
      { name: 'SIM', products: [{ id: 'p_sim' }] },
      { name: 'WiFi', products: [{ id: 'p_wifi_a' }, { id: 'p_wifi_b' }] }
    ]))
    expect(wire).toEqual({
      options: [
        {
          title: { en: 'SIM' },
          input_type: 'radio',
          is_required: true,
          selections: [{ product_id: 'p_sim', is_default: true }]
        },
        {
          title: { en: 'WiFi' },
          input_type: 'radio',
          is_required: true,
          selections: [{ product_id: 'p_wifi_a', is_default: true }, { product_id: 'p_wifi_b' }]
        }
      ]
    })
  })

  it('marks exactly one default per option, which radio requires', () => {
    // more than one would be 422 `default_conflict`
    const draft = toBundleOptionsDraft([{ name: 'SIM', products: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] }])
    expect(draft.options[0]!.selections.filter(s => s.isDefault)).toHaveLength(1)
  })

  it('drops a component with no name or no product', () => {
    expect(toBundleOptionsDraft([
      { name: '', products: [{ id: 'a' }] },
      { name: 'Empty', products: [] },
      { name: 'Empty too', products: [{ id: '' }] }
    ]).options).toEqual([])
  })

  it('sends no ids, because nothing it describes exists yet', () => {
    const draft = toBundleOptionsDraft([{ name: 'SIM', products: [{ id: 'a' }] }])
    expect(draft.options[0]).not.toHaveProperty('id')
    expect(draft.options[0]!.selections[0]).not.toHaveProperty('id')
  })
})
