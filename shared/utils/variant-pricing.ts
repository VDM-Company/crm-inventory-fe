import type { AxisValue, PriceLine, PricePlanDraft, ProductPricing, VertexProduct, VertexProductRow } from '#shared/types'

/**
 * The pure half of the Variant Detail screen.
 *
 * It lives here rather than in the page because the Postman mock cannot serve
 * this screen at all — it ignores path ids, so asking for a variant returns
 * whichever product its canned example holds. These functions are therefore
 * the only part of the page that can be checked, and they are where the
 * decisions worth checking live.
 */

/** How a variant is named in the UI and in the `?variant=` query: `Black / 8 Days`. */
export const variantLabel = (axisValues: AxisValue[] | undefined) =>
  (axisValues || []).map(a => a.label).join(' / ')

/** The child whose axis values spell out this label. */
export function findVariantByLabel(
  children: VertexProductRow[] | null | undefined,
  label: string
): VertexProductRow | null {
  const want = (label || '').trim()
  return (children || []).find(c => variantLabel(c.axisValues) === want) || null
}

/** One row of the price editor. Amounts are strings while being typed. */
export interface PriceComponent {
  feeItemId: string
  amount: string
  isPublished: boolean
  /** From the plan line, so the editor need not join against the fee list. */
  label?: string
  kind?: string
}

/**
 * The recurring price of a saved plan, as the editor holds it.
 *
 * It is a line of its own (`lineType: 'monthly'`) rather than a field, and
 * `linesToComponents` drops it along with every other non-fee line — so a
 * screen that edits prices has to read it separately or it saves the plan
 * back without one.
 */
export function monthlyFromLines(lines: PriceLine[] | undefined): string {
  const line = (lines || []).find(l => l.lineType === 'monthly')
  return line?.amountMonthly == null ? '' : String(line.amountMonthly)
}

/** A saved plan's lines, as the editor holds them. */
export function linesToComponents(lines: PriceLine[] | undefined): PriceComponent[] {
  return (lines || [])
    .filter(l => l.lineType === 'fee' && l.feeItemId)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(l => ({
      feeItemId: l.feeItemId!,
      amount: String(l.amount ?? ''),
      isPublished: l.isPublished !== false,
      label: l.feeName ?? undefined,
      kind: l.feeKind ?? undefined
    }))
}

/**
 * The editor's rows as plan lines.
 *
 * Amounts are integer JPY — the API has no minor unit — so anything that is
 * not a whole number is dropped rather than rounded into a price nobody
 * chose. A row left blank is left out, EXCEPT the base one: a plan must carry
 * exactly one Base Price line, so a blank base becomes zero rather than
 * vanishing and failing upstream with `base_price_required`.
 */
export function componentsToLines(
  components: PriceComponent[],
  baseFeeItemId: string,
  monthly?: string | number | null
): PricePlanDraft['lines'] {
  const out: PricePlanDraft['lines'] = []
  for (const c of components) {
    const isBase = c.feeItemId === baseFeeItemId
    const raw = (c.amount ?? '').toString().trim()
    const n = raw === '' ? NaN : Number(raw)
    const amount = Number.isInteger(n) ? n : NaN

    if (Number.isNaN(amount)) {
      if (!isBase) continue
      out.push({ lineType: 'fee', feeItemId: c.feeItemId, amount: 0, isPublished: c.isPublished !== false })
      continue
    }
    out.push({ lineType: 'fee', feeItemId: c.feeItemId, amount, isPublished: c.isPublished !== false })
  }

  // The recurring price is a line, not a field: `amount` is stored as 0 and
  // the price sits in `amountMonthly`. A subscription product must carry
  // exactly one (422 `monthly_required`), and any other product must carry
  // none (`monthly_not_allowed`) — so a blank or non-integer value adds
  // nothing rather than a zero line, which would be a ¥0 subscription.
  const m = (monthly ?? '').toString().trim()
  const amountMonthly = m === '' ? NaN : Number(m)
  if (Number.isInteger(amountMonthly)) {
    out.push({ lineType: 'monthly', amount: 0, amountMonthly, isPublished: true })
  }

  return out
}

/**
 * Whether a save would change the prices.
 *
 * Every POST to `price-plans` supersedes the active plan and adds a row to
 * the product's price history, so a save that only renamed the variant must
 * not create one. Order is ignored: the API sorts by `sortOrder`, and moving
 * a row without changing an amount is not a price change.
 */
export function pricePlanUnchanged(saved: PriceLine[] | undefined, next: PricePlanDraft['lines']): boolean {
  const key = (l: { lineType: string, feeItemId?: string | null, amount: number, amountMonthly?: number | null, isPublished?: boolean }) =>
    // `?? ''` on both ids: a saved line carries null where a draft line
    // simply leaves the key out, and `null` !== `undefined` as a string
    `${l.lineType}:${l.feeItemId ?? ''}:${l.amount}:${l.amountMonthly ?? ''}:${l.isPublished !== false}`

  // Only the lines this editor owns. A bundle's `selection` lines are saved
  // elsewhere, so counting them here would report a change on every save.
  const owned = (l: { lineType: string, feeItemId?: string | null }) =>
    l.lineType === 'monthly' || (l.lineType === 'fee' && !!l.feeItemId)

  const before = (saved || []).filter(owned).map(key).sort()
  const after = next.filter(owned).map(key).sort()

  return before.length === after.length && before.every((k, i) => k === after[i])
}

// ── the screen's view model ─────────────────────────────────────────────────

/**
 * What the Variant Detail screen renders.
 *
 * Kept as the shape that screen was built around rather than replacing it
 * with the API's: the template is ~500 lines of it. The API's three documents
 * — the parent, the variant product and its pricing — are folded into this on
 * load and unfolded into requests on save, which is the same boundary-adapter
 * pattern the category, attribute and product-row cutovers used.
 */
export interface VariantView {
  /** The variant's own product id — what its prices and status hang off. */
  id: string
  label: string
  sku: string
  description: string
  active: boolean
  stockStatus: string
  lockedFields: string[]
  lockVersion: number
  /** Whether this product is priced monthly. Decides the `monthly` line. */
  isSubscription: boolean
  /** The recurring price, which is a plan line rather than a field. */
  monthly: string
  components: PriceComponent[]
  /** The plan currently in force for the scope on screen, if any. */
  savedLines: PriceLine[]
}

/** The pricing document's entry for one scope. */
export function scopePricing(pricing: ProductPricing | null, scope: string) {
  if (!pricing) return null
  if (scope === 'default') return pricing.default
  return pricing.platforms.find(p => p.scope === scope || p.platform?.id === scope) || null
}

/** Whether this scope prices the product itself rather than following Default. */
export const scopeOverrides = (pricing: ProductPricing | null, scope: string) =>
  scope !== 'default' && scopePricing(pricing, scope)?.source === 'platform'

export function toVariantView(
  variant: VertexProduct,
  pricing: ProductPricing | null,
  scope: string,
  label: string
): VariantView {
  const plan = scopePricing(pricing, scope)?.activePlan ?? null
  return {
    id: variant.id,
    label,
    sku: variant.sku,
    description: variant.description ? Object.values(variant.description)[0] ?? '' : '',
    active: variant.status === 'active',
    stockStatus: variant.stockStatus,
    lockedFields: variant.lockedFields || [],
    lockVersion: variant.lockVersion,
    isSubscription: !!variant.isSubscription,
    monthly: monthlyFromLines(plan?.lines),
    components: linesToComponents(plan?.lines),
    savedLines: plan?.lines || []
  }
}
