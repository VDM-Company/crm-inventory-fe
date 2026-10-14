import type { ProductContent, ProductPlatformContentPatch, ProductPricing } from '#shared/types'
import { localized } from './localized'
import { linesToComponents, monthlyFromLines, scopePricing } from './variant-pricing'

/**
 * Per-platform overrides on the Product Detail screen.
 *
 * The screen had a scope switcher, a name field that remembered what you
 * typed per platform, and price amounts per platform — and none of it was
 * connected at either end. `toDetailView` always set `overrides: {}`, so a
 * platform that really did override something looked like it followed
 * Default; and `persist()` never wrote them, so anything typed was dropped
 * while the save reported success. The whole switcher was decorative.
 *
 * Two API documents answer it: `platform-content` for the name, `pricing`
 * for the money. Both report, per field, whether the value is the platform's
 * own or inherited — which is exactly what the screen needs to show an
 * "Overridden" badge honestly.
 */

/** What one platform overrides, in the screen's own words. */
export interface ScopeOverride {
  name?: string
  priceMonthly?: string | number
  componentAmounts?: Record<string, string>
}

export type Overrides = Record<string, ScopeOverride>

/**
 * The overrides as the screen holds them, keyed by platform id.
 *
 * Only genuine overrides are included. A field whose `source` is `default`
 * is inherited, and putting it here would render an "Overridden" badge on a
 * value nobody overrode.
 */
export function toScopeOverrides(
  content: ProductContent | null | undefined,
  pricing: ProductPricing | null | undefined
): Overrides {
  const out: Overrides = {}

  for (const entry of content?.platforms || []) {
    const id = entry.platform?.id
    if (!id) continue
    if (entry.name?.source === 'platform') {
      out[id] = { ...out[id], name: localized(entry.name.value) }
    }
  }

  for (const scope of pricing?.platforms || []) {
    const id = scope.platform?.id || scope.scope
    // `source: 'default'` means this platform follows the Default plan
    if (!id || scope.source !== 'platform') continue
    const lines = scope.activePlan?.lines
    const amounts: Record<string, string> = {}
    for (const c of linesToComponents(lines)) amounts[c.feeItemId] = c.amount
    out[id] = { ...out[id], componentAmounts: amounts, priceMonthly: monthlyFromLines(lines) }
  }

  return out
}

/** Each platform's own `lockVersion`, which its content PATCH requires. */
export function contentLockVersions(content: ProductContent | null | undefined): Record<string, number> {
  const out: Record<string, number> = {}
  for (const entry of content?.platforms || []) {
    if (entry.platform?.id) out[entry.platform.id] = entry.lockVersion
  }
  return out
}

/**
 * The content PATCH for one platform, or null when nothing about its content
 * moved.
 *
 * A name that was overridden and is now gone is not "no change" — it has to
 * be RESET, or the platform keeps the old override forever. That is the case
 * a naive diff misses, so it is the one spelled out here.
 */
export function contentPatchFor(
  before: ScopeOverride | undefined,
  after: ScopeOverride | undefined
): ProductPlatformContentPatch | null {
  const had = before?.name !== undefined
  const has = after?.name !== undefined && String(after.name).trim() !== ''

  if (has && String(after!.name) !== String(before?.name ?? '')) {
    return { name: { en: String(after!.name).trim() } }
  }
  if (had && !has) return { reset: ['name'] }
  return null
}

/** Whether this platform's prices moved. */
export function pricingChanged(before: ScopeOverride | undefined, after: ScopeOverride | undefined): boolean {
  const key = (o: ScopeOverride | undefined) => JSON.stringify({
    monthly: String(o?.priceMonthly ?? ''),
    amounts: Object.fromEntries(
      Object.entries(o?.componentAmounts || {}).filter(([, v]) => String(v ?? '') !== '').sort()
    )
  })
  return key(before) !== key(after)
}

/** Whether a platform prices separately already, or still follows Default. */
export const scopeOverridesPricing = (pricing: ProductPricing | null | undefined, platformId: string) =>
  scopePricing(pricing ?? null, platformId)?.source === 'platform'

/**
 * The platforms whose overrides changed, and what changed about each.
 *
 * Returned rather than acted on so the page can report exactly which ones it
 * is about to write, and so the decision is testable without a server.
 */
export interface OverrideChange {
  platformId: string
  content: ProductPlatformContentPatch | null
  pricing: boolean
}

export function diffOverrides(before: Overrides, after: Overrides): OverrideChange[] {
  const ids = [...new Set([...Object.keys(before || {}), ...Object.keys(after || {})])].sort()
  const out: OverrideChange[] = []
  for (const platformId of ids) {
    const content = contentPatchFor(before?.[platformId], after?.[platformId])
    const pricing = pricingChanged(before?.[platformId], after?.[platformId])
    if (content || pricing) out.push({ platformId, content, pricing })
  }
  return out
}
