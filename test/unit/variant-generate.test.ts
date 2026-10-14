import { describe, expect, it } from 'vitest'
import {
  combinationsFrom,
  generateBlockedReason,
  generateOutcome,
  toPreviewSummary
} from '../../shared/utils/variant-generate'
import type { VariantPreview } from '../../shared/types/vertex'

const BLACK = 'o_black'
const WHITE = 'o_white'
const D8 = 'o_8d'

const candidate = (over: Record<string, unknown> = {}) => ({
  combination: [BLACK, D8],
  label: 'Black / 8 Days',
  name: { en: 'X1 - Black / 8 Days' },
  suggestedSku: 'X1-BLK-8D',
  skuStatus: 'available',
  existingProductId: null,
  ...over
}) as VariantPreview['candidates'][number]

const preview = (over: Partial<VariantPreview> = {}): VariantPreview => ({
  candidates: [candidate()],
  willDelete: [],
  willDisable: [],
  ...over
})

describe('toPreviewSummary', () => {
  it('separates what is created from what already exists', () => {
    const s = toPreviewSummary(preview({
      candidates: [
        candidate(),
        candidate({ combination: [WHITE, D8], label: 'White / 8 Days', suggestedSku: 'X1-WHT-8D', existingProductId: 'v_old' })
      ]
    }))
    expect(s.creating.map(r => r.label)).toEqual(['Black / 8 Days'])
    expect(s.keeping.map(r => r.label)).toEqual(['White / 8 Days'])
  })

  it('reads `willDelete` and `willDisable`, which is what the API sends', () => {
    // these were typed `toDelete`/`toDisable`, so they read undefined and the
    // confirmation would have listed nothing while the generate removed them
    const s = toPreviewSummary(preview({
      willDelete: [{ productId: 'v1', sku: 'X1-RED-8D', name: { en: 'Red / 8 Days' } }],
      willDisable: [{ productId: 'v2', sku: 'X1-BLU-8D' }]
    }))
    expect(s.deleting).toEqual([{ id: 'v1', label: 'Red / 8 Days', sku: 'X1-RED-8D' }])
    // no name — the SKU is the only thing left to call it
    expect(s.disabling).toEqual([{ id: 'v2', label: 'X1-BLU-8D', sku: 'X1-BLU-8D' }])
  })

  it('tells a SKU held by this variant from one held by something else', () => {
    // `existing` is this variant's own SKU; `taken` is another product's
    const s = toPreviewSummary(preview({
      candidates: [
        candidate({ skuStatus: 'existing' }),
        candidate({ combination: [WHITE, D8], label: 'White / 8 Days', skuStatus: 'taken' })
      ]
    }))
    expect(s.keeping.map(r => r.label)).toEqual(['Black / 8 Days'])
    expect(s.skuConflicts.map(r => r.label)).toEqual(['White / 8 Days'])
    expect(s.creating).toEqual([])
  })

  it('is a noop when nothing is created, deleted or disabled', () => {
    expect(toPreviewSummary(preview({ candidates: [candidate({ existingProductId: 'v1' })] })).noop).toBe(true)
    expect(toPreviewSummary(preview()).noop).toBe(false)
  })

  it('survives an empty preview', () => {
    const s = toPreviewSummary(null)
    expect(s).toMatchObject({ creating: [], keeping: [], deleting: [], disabling: [], noop: true })
  })
})

describe('generateBlockedReason', () => {
  it('allows an ordinary generate', () => {
    expect(generateBlockedReason(toPreviewSummary(preview()))).toBeNull()
  })

  it('refuses when a SKU belongs to another product', () => {
    // 422 `sku_taken`, and there is no SKU editor on this screen
    const r = generateBlockedReason(toPreviewSummary(preview({
      candidates: [candidate({ skuStatus: 'taken' })]
    })))
    expect(r).toContain('X1-BLK-8D')
  })

  it('refuses a conversion carrying live subscriptions', () => {
    // the API wants `subscriptionTargetCombination`; picking it for someone
    // is not a guess worth making
    const r = generateBlockedReason(toPreviewSummary(preview({
      conversion: { oldSku: 'X1', activeSubscriptions: 3, bundlesAffected: 0, bundles: [] }
    })))
    expect(r).toContain('3 active subscription(s)')
  })

  it('refuses a conversion the bundles depend on', () => {
    const r = generateBlockedReason(toPreviewSummary(preview({
      conversion: { oldSku: 'X1', activeSubscriptions: 0, bundlesAffected: 2, bundles: [] }
    })))
    expect(r).toContain('2 bundle(s)')
  })

  it('allows a conversion that drags nothing along', () => {
    expect(generateBlockedReason(toPreviewSummary(preview({
      conversion: { oldSku: 'X1', activeSubscriptions: 0, bundlesAffected: 0, bundles: [] }
    })))).toBeNull()
  })

  it('refuses an empty matrix rather than deleting every variant', () => {
    const r = generateBlockedReason(toPreviewSummary(preview({ candidates: [] })))
    expect(r).toContain('no variants')
  })
})

describe('combinationsFrom', () => {
  it('sends the SKU the confirmation showed', () => {
    // without it the API generates its own, which may not be what was agreed
    const p = preview()
    expect(combinationsFrom(toPreviewSummary(p), p)).toEqual([
      { optionIds: [BLACK, D8], sku: 'X1-BLK-8D' }
    ])
  })

  it('carries the ones that already exist too, so they are not dropped', () => {
    const p = preview({ candidates: [candidate({ existingProductId: 'v1' })] })
    expect(combinationsFrom(toPreviewSummary(p), p)).toHaveLength(1)
  })

  it('leaves out a candidate whose SKU another product holds', () => {
    const p = preview({ candidates: [candidate(), candidate({ combination: [WHITE, D8], skuStatus: 'taken' })] })
    expect(combinationsFrom(toPreviewSummary(p), p)).toEqual([
      { optionIds: [BLACK, D8], sku: 'X1-BLK-8D' }
    ])
  })

  it('omits the sku key when there is no suggestion', () => {
    const p = preview({ candidates: [candidate({ suggestedSku: '' })] })
    expect(combinationsFrom(toPreviewSummary(p), p)).toEqual([{ optionIds: [BLACK, D8] }])
  })
})

describe('generateOutcome', () => {
  it('says the work is running when the API queued it', () => {
    // over 100 variants answers 202 with a job id, and nothing polls it
    const o = generateOutcome({ jobId: 'job_1', statusUrl: '/x' })
    expect(o.queued).toBe(true)
    expect(o.message).toContain('Reload')
  })

  it('counts what came back otherwise', () => {
    expect(generateOutcome({ created: [{}, {}] as never }).message).toBe('2 variants generated')
    expect(generateOutcome({ created: [{}] as never }).message).toBe('1 variant generated')
  })

  it('does not claim a count it was not given', () => {
    expect(generateOutcome(null).message).toBe('0 variants generated')
  })
})
