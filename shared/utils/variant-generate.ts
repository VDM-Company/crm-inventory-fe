import type { VariantCombination, VariantGenerateResult, VariantPreview } from '#shared/types'
import { localized } from './localized'

/**
 * The pure half of generating variants on an existing product.
 *
 * `generateVariants` REPLACES the whole set. A combination missing from the
 * new axes is removed if it was never ordered, and switched off if it was —
 * so the one thing this screen must never do is run it without saying what
 * it is about to destroy. `previewVariants` reports exactly that, and
 * everything here exists to turn that report into a sentence someone can
 * say yes or no to.
 */

/** One line of the confirmation. */
export interface PreviewLine {
  id: string
  label: string
  sku: string
}

export interface PreviewSummary {
  /** Combinations that do not exist yet. */
  creating: PreviewLine[]
  /** Combinations that already exist and keep their SKU. */
  keeping: PreviewLine[]
  /** Removed outright — never ordered. */
  deleting: PreviewLine[]
  /** Kept but switched off, because they have orders. */
  disabling: PreviewLine[]
  /** Candidates whose suggested SKU is already taken by something else. */
  skuConflicts: PreviewLine[]
  /** Set when a simple product would become configurable. */
  conversion: VariantPreview['conversion']
  /** True when nothing would change at all. */
  noop: boolean
}

const line = (id: string, label: string, sku: string): PreviewLine => ({ id, label, sku })

/**
 * The preview as the confirmation reads it.
 *
 * `skuStatus` carries the one distinction that decides whether a candidate
 * can be created: `existing` means this very variant already has that SKU,
 * while `taken` means something ELSE holds it and generating would be 422
 * `sku_taken`.
 */
export function toPreviewSummary(preview: VariantPreview | null | undefined): PreviewSummary {
  const candidates = preview?.candidates || []

  const creating: PreviewLine[] = []
  const keeping: PreviewLine[] = []
  const skuConflicts: PreviewLine[] = []

  for (const c of candidates) {
    const row = line(c.combination.join('|'), c.label, c.suggestedSku)
    if (c.existingProductId || c.skuStatus === 'existing') keeping.push(row)
    else if (c.skuStatus === 'taken') skuConflicts.push(row)
    else creating.push(row)
  }

  const deleting = (preview?.willDelete || []).map(v =>
    line(v.productId, v.name ? localized(v.name) : v.sku, v.sku))
  const disabling = (preview?.willDisable || []).map(v =>
    line(v.productId, v.name ? localized(v.name) : v.sku, v.sku))

  return {
    creating,
    keeping,
    deleting,
    disabling,
    skuConflicts,
    conversion: preview?.conversion,
    noop: !creating.length && !deleting.length && !disabling.length
  }
}

/**
 * Why this generate must not run, or null when it may.
 *
 * Two of these are refusals rather than warnings, because the API would
 * reject them and the screen has nothing to offer in response:
 *
 * - a SKU another product already holds — 422 `sku_taken`, and the SKU
 *   editor for candidates is not built;
 * - a conversion carrying live subscriptions or bundles, which needs
 *   `subscriptionTargetCombination` — the screen has no picker for which
 *   variant those subscribers should land on, and choosing for them is not
 *   something to guess at.
 */
export function generateBlockedReason(summary: PreviewSummary): string | null {
  // no candidates AT ALL — not merely none that can be created, which a
  // SKU conflict also produces and has its own, more useful message below
  if (!summary.creating.length && !summary.keeping.length && !summary.skuConflicts.length) {
    return 'These attributes produce no variants. Pick at least one value on each.'
  }

  if (summary.skuConflicts.length) {
    const names = summary.skuConflicts.map(s => `${s.label} (${s.sku})`).join(', ')
    return `Another product already uses the SKU for: ${names}. Change it there first.`
  }

  const c = summary.conversion
  if (c && (c.activeSubscriptions > 0 || c.bundlesAffected > 0)) {
    const parts: string[] = []
    if (c.activeSubscriptions > 0) parts.push(`${c.activeSubscriptions} active subscription(s)`)
    if (c.bundlesAffected > 0) parts.push(`${c.bundlesAffected} bundle(s)`)
    return `This product has ${parts.join(' and ')}, which have to be moved to a specific variant. `
      + 'That choice is not part of this screen yet, so generating is blocked here.'
  }

  return null
}

/**
 * The combinations to send, carrying each candidate's suggested SKU.
 *
 * Sent explicitly rather than left out: without them the API generates its
 * own, which may not be the SKU the confirmation just showed. What someone
 * agreed to is what gets written.
 */
export function combinationsFrom(summary: PreviewSummary, preview: VariantPreview | null | undefined): VariantCombination[] {
  const wanted = new Set([...summary.creating, ...summary.keeping].map(r => r.id))
  return (preview?.candidates || [])
    .filter(c => wanted.has(c.combination.join('|')))
    .map(c => (c.suggestedSku ? { optionIds: c.combination, sku: c.suggestedSku } : { optionIds: c.combination }))
}

/**
 * What to tell the reader after generating.
 *
 * Over 100 variants the API answers 202 with a job id instead of the
 * products. Nothing polls it — `GET /admin/jobs/:job` is not wired — so the
 * honest thing is to say the work is running and that the page will not
 * update itself, rather than show a count that never arrives.
 */
export function generateOutcome(result: VariantGenerateResult | null | undefined): { queued: boolean, message: string } {
  if (result?.jobId) {
    return {
      queued: true,
      message: 'That is a large set, so the API is building it in the background. '
        + 'Reload in a moment to see the variants.'
    }
  }
  const n = result?.created?.length ?? 0
  return { queued: false, message: n === 1 ? '1 variant generated' : `${n} variants generated` }
}
