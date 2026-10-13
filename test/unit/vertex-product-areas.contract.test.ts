import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  vertexPricePlanCreateSchema,
  vertexVariantAxesSchema,
  vertexVariantSimulateSchema,
  vertexBundleOptionsSchema,
  vertexBundlePriceSchema,
  vertexProductPlatformContentSchema
} from '../../shared/schemas'
import { fromVertex, toVertex } from '../../shared/utils/vertex-wire'
import { localized } from '../../shared/utils/localized'
import { variantLabel } from '../../shared/utils/variant-pricing'
import type { BundleOption, BundleQuote, PricePlan, ProductContent, ProductPricing, VariantPreview } from '../../shared/types/vertex'

interface PostmanResponse { code: number, name?: string, body?: string, originalRequest?: { body?: { raw?: string } } }
interface PostmanRequest { method?: string, url?: { raw?: string } | string, body?: { raw?: string } }
interface PostmanItem { name: string, item?: PostmanItem[], request?: PostmanRequest, response?: PostmanResponse[] }

const collection = JSON.parse(
  readFileSync(resolve(__dirname, '../../docs/api/vertex-commerce.postman_collection.json'), 'utf8')
) as { item: PostmanItem[] }

function* walk(items: PostmanItem[]): Generator<PostmanItem> {
  for (const it of items) {
    if (it.item) yield* walk(it.item)
    else yield it
  }
}
const rawUrl = (r?: PostmanRequest) => (typeof r?.url === 'string' ? r.url : r?.url?.raw) || ''

function endpoint(path: string, method: string): PostmanItem {
  for (const it of walk(collection.item)) {
    const url = rawUrl(it.request)
    if (!url.includes('/admin/product')) continue
    if (it.request?.method !== method) continue
    if (url.split('?')[0]!.endsWith(path)) return it
  }
  throw new Error(`no ${method} ${path} in the collection`)
}
const example = (item: PostmanItem, code: number) => {
  const r = (item.response || []).find(x => x.code === code)
  if (!r) throw new Error(`no ${code} example on ${item.name}`)
  return r.body ? JSON.parse(r.body) : null
}

describe('pricing', () => {
  it('reports a mode and source per scope, with the plan in force', () => {
    const p = fromVertex<ProductPricing>(example(endpoint('/pricing', 'GET'), 200).data)

    expect(p.default.scope).toBe('default')
    expect(p.default.mode).toBe('override')
    expect(p.default.source).toBe('default')
    expect(p.default.activePlan?.status).toBe('active')
  })

  it('prices in whole yen on every line', () => {
    const p = fromVertex<ProductPricing>(example(endpoint('/pricing', 'GET'), 200).data)
    for (const line of p.default.activePlan!.lines) {
      expect(Number.isInteger(line.amount)).toBe(true)
    }
  })

  it('denormalises the fee onto the line, so a screen need not join', () => {
    const p = fromVertex<ProductPricing>(example(endpoint('/pricing', 'GET'), 200).data)
    const base = p.default.activePlan!.lines.find(l => l.feeKind === 'base')!

    expect(base.feeCode).toBe('base_price')
    expect(base.feeName).toBe('Base Price')
  })

  it('keeps a scheduled plan apart from the active one', () => {
    const plans = fromVertex<PricePlan[]>(example(endpoint('/price-plans', 'GET'), 200).data)
    const scheduled = plans.find(p => p.status === 'scheduled')

    expect(scheduled).toBeDefined()
    expect(Date.parse(scheduled!.effectiveAt!)).toBeGreaterThan(Date.parse('2026-10-07T00:00:00Z'))
  })

  it('builds the plan body the collection sends', () => {
    const body = JSON.parse(endpoint('/price-plans', 'POST').request!.body!.raw!)
    const draft = vertexPricePlanCreateSchema.parse({
      scope: 'default',
      effectiveAt: null,
      lines: body.lines.map((l: Record<string, unknown>) => ({
        lineType: l.line_type,
        feeItemId: l.fee_item_id,
        amount: l.amount,
        isPublished: l.is_published
      }))
    })

    expect(toVertex(draft)).toEqual(body)
  })

  it('refuses a fee line with no fee item, and a selection line with no selection', () => {
    const plan = (lines: unknown[]) => () => vertexPricePlanCreateSchema.parse({ scope: 'default', lines })

    expect(plan([{ lineType: 'fee', amount: 100 }])).toThrow()
    expect(plan([{ lineType: 'selection', amount: 100 }])).toThrow()
    expect(plan([{ lineType: 'fee', feeItemId: 'f1', amount: 100 }])).not.toThrow()
    expect(plan([{ lineType: 'selection', bundleSelectionId: 's1', amount: 100 }])).not.toThrow()
  })

  it('wants whole yen, not a fractional amount', () => {
    expect(() => vertexPricePlanCreateSchema.parse({
      scope: 'default', lines: [{ lineType: 'fee', feeItemId: 'f1', amount: 10.5 }]
    })).toThrow()
  })

  it('refuses a plan with no lines at all', () => {
    expect(() => vertexPricePlanCreateSchema.parse({ scope: 'default', lines: [] })).toThrow()
  })
})

describe('variants', () => {
  it('suggests a SKU per combination and says whether it is free', () => {
    const p = fromVertex<VariantPreview>(example(endpoint('/variants/preview', 'POST'), 200).data)
    const first = p.candidates[0]!

    expect(first.combination).toHaveLength(2)
    expect(first.suggestedSku).toBe('WIFI-X1-8DAYS-BLACK')
    expect(first.skuStatus).toBe('available')
    expect(localized(first.name)).toContain('Black / 8 Days')
  })

  it('names an existing product when the combination already exists', () => {
    const p = fromVertex<VariantPreview>(example(endpoint('/variants/preview', 'POST'), 200).data)
    for (const c of p.candidates) expect(c).toHaveProperty('existingProductId')
  })

  it('builds the axes body the collection sends', () => {
    const body = JSON.parse(endpoint('/variants/preview', 'POST').request!.body!.raw!)
    const parsed = vertexVariantAxesSchema.parse({
      axes: body.axes.map((a: Record<string, unknown>) => ({
        attributeId: a.attribute_id, optionIds: a.option_ids
      }))
    })
    expect(toVertex(parsed)).toEqual(body)
  })

  it('refuses an axis with no options, and a matrix with no axes', () => {
    expect(() => vertexVariantAxesSchema.parse({ axes: [{ attributeId: 'a1', optionIds: [] }] })).toThrow()
    expect(() => vertexVariantAxesSchema.parse({ axes: [] })).toThrow()
  })

  it('takes the sku and name on simulate, because the product does not exist yet', () => {
    const body = JSON.parse(endpoint('/variants/simulate', 'POST').request!.body!.raw!)
    const parsed = vertexVariantSimulateSchema.parse({
      sku: 'WIFI-X1',
      name: { en: 'Pocket WiFi Router X1' },
      axes: body.axes.map((a: Record<string, unknown>) => ({ attributeId: a.attribute_id, optionIds: a.option_ids }))
    })

    expect(toVertex(parsed)).toEqual(body)
    expect(() => vertexVariantSimulateSchema.parse({ name: { en: 'x' }, axes: [{ attributeId: 'a', optionIds: ['o'] }] })).toThrow()
  })
})

describe('variant children', () => {
  // the only examples that carry them: duplicate and generate both answer with
  // the parent and its four variants
  const withChildren = () => example(endpoint('/duplicate', 'POST'), 201).data

  it('returns variants as LIST rows, not full product records', () => {
    const parent = fromVertex<Record<string, unknown>>(withChildren())
    const kids = parent.children as Record<string, unknown>[]

    expect(kids).toHaveLength(4)
    // a list row: it has priceFrom and imageUrl, and no detail-only fields
    expect(kids[0]).toHaveProperty('priceFrom')
    expect(kids[0]).toHaveProperty('variantCount')
    expect(kids[0]).not.toHaveProperty('attributes')
    expect(kids[0]).not.toHaveProperty('lockedFields')
  })

  it('carries the axis values the screen names a variant by', () => {
    const kids = (fromVertex<Record<string, unknown>>(withChildren()).children) as {
      axisValues: { attributeLabel: string, label: string }[]
    }[]

    expect(kids[0]!.axisValues).toEqual([
      { attributeLabel: 'Color', label: 'Black' },
      { attributeLabel: 'Validity', label: '8 Days' }
    ])
    expect(variantLabel(kids[0]!.axisValues)).toBe('Black / 8 Days')
  })

  it('gives every variant its own id, which is what its prices hang off', () => {
    const kids = (fromVertex<Record<string, unknown>>(withChildren()).children) as { id: string }[]
    expect(new Set(kids.map(k => k.id)).size).toBe(4)
  })
})

describe('bundles', () => {
  it('reads options with their selections and each selection id', () => {
    const opts = fromVertex<BundleOption[]>(example(endpoint('/bundle-options', 'GET'), 200).data)

    expect(localized(opts[0]!.title)).toBe('SIM')
    expect(opts[0]!.isRequired).toBe(true)
    expect(opts[0]!.selections[0]!.id).toBeTruthy()
    expect(opts[0]!.selections[0]!.productId).toBeTruthy()
  })

  it('quotes a choice set in whole yen, base plus each selection', () => {
    const q = fromVertex<BundleQuote>(example(endpoint('/bundle-price', 'POST'), 200).data)

    expect(q.initialTotal).toBe(7000)
    expect(q.selections.reduce((n, s) => n + s.total, 0) + q.base.initialTotal).toBe(q.initialTotal)
    for (const s of q.selections) expect(Number.isInteger(s.unitAmount)).toBe(true)
  })

  it('builds the contents body the collection sends', () => {
    const body = JSON.parse(endpoint('/bundle-options', 'PUT').request!.body!.raw!)
    const parsed = vertexBundleOptionsSchema.parse({
      options: body.options.map((o: Record<string, unknown>) => ({
        title: o.title,
        inputType: o.input_type,
        isRequired: o.is_required,
        selections: (o.selections as Record<string, unknown>[]).map(s => ({
          productId: s.product_id, isDefault: s.is_default
        }))
      }))
    })
    expect(toVertex(parsed)).toEqual(body)
  })

  it('refuses an empty bundle and an option with no selections', () => {
    expect(() => vertexBundleOptionsSchema.parse({ options: [] })).toThrow()
    expect(() => vertexBundleOptionsSchema.parse({
      options: [{ title: { en: 'X' }, inputType: 'radio', selections: [] }]
    })).toThrow()
  })

  it('wants at least one choice to quote', () => {
    expect(() => vertexBundlePriceSchema.parse({ choices: [] })).toThrow()
  })
})

describe('per-platform product content', () => {
  it('reports each field with its value and where it came from', () => {
    const c = fromVertex<ProductContent>(example(endpoint('/platform-content', 'GET'), 200).data)
    const first = c.platforms[0]!

    expect(localized(c.default.name)).toBe('Tourist SIM 15GB')
    expect(first.name.source).toBe('platform')
    expect(typeof first.lockVersion).toBe('number')
  })

  it('lists a platform that no longer sells it but still overrides', () => {
    const c = fromVertex<ProductContent>(example(endpoint('/platform-content', 'GET'), 200).data)
    expect(c.platforms.some(p => p.assigned === false)).toBe(true)
  })

  it('sends reset entries in the API spelling, not the app one', () => {
    // `categoryIds` is the one that would break silently: the case mapper
    // renames keys, and these are values
    const parsed = vertexProductPlatformContentSchema.parse({
      lockVersion: 1, reset: ['categoryIds', 'name']
    })
    expect(toVertex(parsed)).toEqual({ lock_version: 1, reset: ['category_ids', 'name'] })
  })

  it('still catches a multi-word field that is both set and reset', () => {
    expect(() => vertexProductPlatformContentSchema.parse({
      lockVersion: 1, categoryIds: ['c1'], reset: ['categoryIds']
    })).toThrow()
  })

  it('refuses a body that neither overrides nor resets anything', () => {
    expect(() => vertexProductPlatformContentSchema.parse({ lockVersion: 1 })).toThrow()
  })

  it('refuses an update with no lockVersion', () => {
    expect(() => vertexProductPlatformContentSchema.parse({ name: { en: 'x' } })).toThrow()
  })
})
