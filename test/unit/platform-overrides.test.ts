import { describe, expect, it } from 'vitest'
import {
  contentLockVersions,
  contentPatchFor,
  diffOverrides,
  pricingChanged,
  toScopeOverrides
} from '../../shared/utils/platform-overrides'
import type { ProductContent, ProductPricing } from '../../shared/types/vertex'

const SKSIM = 'pf_sksim'
const SIMPOINT = 'pf_simpoint'
const BASE = 'fee_base'
const TAX = 'fee_tax'

const content = (platforms: unknown[]): ProductContent => ({
  productId: 'p1',
  default: { name: { en: 'Tourist SIM 15GB' }, notes: null, media: [], categoryIds: [] },
  platforms: platforms as ProductContent['platforms']
})

const line = (feeItemId: string | null, amount: number, extra: Record<string, unknown> = {}) => ({
  id: 'l_' + (feeItemId ?? 'm'),
  lineType: feeItemId ? 'fee' : 'monthly',
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

const pricing = (platforms: unknown[]): ProductPricing => ({
  default: { scope: 'default', mode: 'own', source: 'default', activePlan: null } as ProductPricing['default'],
  platforms: platforms as ProductPricing['platforms']
})

describe('toScopeOverrides', () => {
  it('keeps only the fields a platform actually overrides', () => {
    // `source: 'default'` means inherited; listing it would put an
    // "Overridden" badge on a value nobody overrode
    const out = toScopeOverrides(
      content([
        { platform: { id: SKSIM }, assigned: true, lockVersion: 3, name: { value: { en: 'Japan Tourist SIM' }, source: 'platform' } },
        { platform: { id: SIMPOINT }, assigned: true, lockVersion: 1, name: { value: { en: 'Tourist SIM 15GB' }, source: 'default' } }
      ]),
      null
    )
    expect(out).toEqual({ [SKSIM]: { name: 'Japan Tourist SIM' } })
  })

  it('folds a platform’s own price plan into amounts and a monthly', () => {
    const out = toScopeOverrides(null, pricing([
      {
        scope: SKSIM,
        platform: { id: SKSIM },
        source: 'platform',
        activePlan: { lines: [line(BASE, 3300), line(TAX, 330), line(null, 0, { lineType: 'monthly', amountMonthly: 2980 })] }
      }
    ]))
    expect(out[SKSIM]).toEqual({
      componentAmounts: { [BASE]: '3300', [TAX]: '330' },
      priceMonthly: '2980'
    })
  })

  it('ignores a platform that follows the Default price', () => {
    const out = toScopeOverrides(null, pricing([
      { scope: SKSIM, platform: { id: SKSIM }, source: 'default', activePlan: { lines: [line(BASE, 3300)] } }
    ]))
    expect(out).toEqual({})
  })

  it('merges a name override and a price override for the same platform', () => {
    const out = toScopeOverrides(
      content([{ platform: { id: SKSIM }, assigned: true, lockVersion: 2, name: { value: { en: 'JP SIM' }, source: 'platform' } }]),
      pricing([{ scope: SKSIM, platform: { id: SKSIM }, source: 'platform', activePlan: { lines: [line(BASE, 4400)] } }])
    )
    expect(out[SKSIM]).toEqual({ name: 'JP SIM', componentAmounts: { [BASE]: '4400' }, priceMonthly: '' })
  })

  it('survives both documents being absent', () => {
    expect(toScopeOverrides(null, null)).toEqual({})
    expect(toScopeOverrides(undefined, undefined)).toEqual({})
  })
})

describe('contentLockVersions', () => {
  it('is each platform’s own version, not the product’s', () => {
    // sending the product's would be a 409 on every save
    expect(contentLockVersions(content([
      { platform: { id: SKSIM }, assigned: true, lockVersion: 3, name: { value: { en: 'x' }, source: 'platform' } },
      { platform: { id: SIMPOINT }, assigned: true, lockVersion: 7, name: { value: { en: 'y' }, source: 'default' } }
    ]))).toEqual({ [SKSIM]: 3, [SIMPOINT]: 7 })
  })
})

describe('contentPatchFor', () => {
  it('overrides a name that was typed', () => {
    expect(contentPatchFor(undefined, { name: 'JP SIM' })).toEqual({ name: { en: 'JP SIM' } })
  })

  it('RESETS a name that was overridden and is now gone', () => {
    // the case a naive diff misses: without `reset` the platform keeps the
    // old override forever
    expect(contentPatchFor({ name: 'JP SIM' }, {})).toEqual({ reset: ['name'] })
    expect(contentPatchFor({ name: 'JP SIM' }, { name: '' })).toEqual({ reset: ['name'] })
    expect(contentPatchFor({ name: 'JP SIM' }, { name: '   ' })).toEqual({ reset: ['name'] })
  })

  it('is null when the name did not move', () => {
    expect(contentPatchFor({ name: 'JP SIM' }, { name: 'JP SIM' })).toBeNull()
    expect(contentPatchFor(undefined, undefined)).toBeNull()
    expect(contentPatchFor({}, {})).toBeNull()
  })

  it('trims, so whitespace alone is not an override', () => {
    expect(contentPatchFor(undefined, { name: '  JP SIM  ' })).toEqual({ name: { en: 'JP SIM' } })
  })

  it('does not reset a name that was never overridden', () => {
    expect(contentPatchFor(undefined, { name: '' })).toBeNull()
  })
})

describe('pricingChanged', () => {
  it('sees an amount move', () => {
    expect(pricingChanged({ componentAmounts: { [BASE]: '3300' } }, { componentAmounts: { [BASE]: '4400' } })).toBe(true)
  })

  it('sees a monthly move', () => {
    expect(pricingChanged({ priceMonthly: '2980' }, { priceMonthly: '3280' })).toBe(true)
  })

  it('is false when nothing moved, whatever the key order', () => {
    const a = { componentAmounts: { [BASE]: '3300', [TAX]: '330' }, priceMonthly: '2980' }
    const b = { componentAmounts: { [TAX]: '330', [BASE]: '3300' }, priceMonthly: '2980' }
    expect(pricingChanged(a, b)).toBe(false)
  })

  it('treats a blank amount as absent, so clearing a field nobody set is no change', () => {
    expect(pricingChanged({}, { componentAmounts: { [BASE]: '' } })).toBe(false)
    expect(pricingChanged({ componentAmounts: { [BASE]: '' } }, {})).toBe(false)
  })

  it('sees an override being removed entirely', () => {
    expect(pricingChanged({ componentAmounts: { [BASE]: '3300' } }, {})).toBe(true)
  })
})

describe('diffOverrides', () => {
  it('reports only the platforms that changed', () => {
    const before = { [SKSIM]: { name: 'JP SIM' }, [SIMPOINT]: { componentAmounts: { [BASE]: '3300' } } }
    const after = { [SKSIM]: { name: 'JP SIM' }, [SIMPOINT]: { componentAmounts: { [BASE]: '4400' } } }
    expect(diffOverrides(before, after)).toEqual([
      { platformId: SIMPOINT, content: null, pricing: true }
    ])
  })

  it('carries both kinds of change for one platform', () => {
    expect(diffOverrides({}, { [SKSIM]: { name: 'JP', componentAmounts: { [BASE]: '1' } } })).toEqual([
      { platformId: SKSIM, content: { name: { en: 'JP' } }, pricing: true }
    ])
  })

  it('includes a platform that only appears on one side', () => {
    expect(diffOverrides({ [SKSIM]: { name: 'JP' } }, {})).toEqual([
      { platformId: SKSIM, content: { reset: ['name'] }, pricing: false }
    ])
  })

  it('is empty when nothing moved', () => {
    const same = { [SKSIM]: { name: 'JP SIM', componentAmounts: { [BASE]: '3300' } } }
    expect(diffOverrides(same, JSON.parse(JSON.stringify(same)))).toEqual([])
    expect(diffOverrides({}, {})).toEqual([])
  })
})
