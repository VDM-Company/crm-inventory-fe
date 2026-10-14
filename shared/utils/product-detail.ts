import type { BundleOption, LocalizedText, ProductPricing, VertexProduct, VertexProductPatch } from '#shared/types'
import { localized } from './localized'
import { monthlyFromLines } from './variant-pricing'

/**
 * The pure half of the Product Detail screen.
 *
 * Here for the same reason as `variant-pricing.ts`: the Postman mock ignores
 * path ids, so this screen cannot be exercised in a browser at all. These
 * functions hold the decisions worth checking.
 */

/** The fields the identity and classification form edits. */
export interface DetailEditable {
  name: string
  sku: string
  notes: string
  description: string
  categoryId: string
  platformIds: string[]
  /** The screen calls it "not for sale"; the API calls it a gift. */
  notForSale: boolean
}

export function toDetailEditable(p: VertexProduct, locale = 'en'): DetailEditable {
  return {
    name: localized(p.name, locale),
    sku: p.sku,
    notes: p.notes ?? '',
    description: localized(p.description, locale),
    categoryId: (p.categories || [])[0]?.id ?? '',
    platformIds: (p.platforms || []).map(x => x.id),
    notForSale: !!p.isGift
  }
}

const sameIds = (a: string[], b: string[]) =>
  a.length === b.length && [...a].sort().every((v, i) => v === [...b].sort()[i])

/**
 * Only what changed.
 *
 * A PATCH that resends every field looks harmless but is not: `sku` is
 * refused once the product leaves Draft (422 `field_locked`), so sending it
 * unchanged would fail a save that changed only the notes. Sending nothing
 * when nothing changed also means the caller can skip the request.
 *
 * `name` and `description` go as locale maps, and the single category the
 * screen edits becomes the array the API takes.
 */
export function detailPatch(before: DetailEditable, after: DetailEditable, locale = 'en'): VertexProductPatch {
  const patch: VertexProductPatch = {}
  const text = (v: string): LocalizedText => ({ [locale]: v })

  if (after.name !== before.name) patch.name = text(after.name)
  if (after.sku !== before.sku) patch.sku = after.sku
  if (after.notes !== before.notes) patch.notes = after.notes || null
  if (after.description !== before.description) {
    patch.description = after.description ? text(after.description) : null
  }
  if (after.categoryId !== before.categoryId) {
    patch.categoryIds = after.categoryId ? [after.categoryId] : []
  }
  if (!sameIds(after.platformIds, before.platformIds)) patch.platformIds = after.platformIds
  if (after.notForSale !== before.notForSale) patch.isGift = after.notForSale

  return patch
}

export const hasChanges = (patch: VertexProductPatch) => Object.keys(patch).length > 0

// ── read-only views of the parts this pass does not edit ───────────────────

/** A bundle's contents, flattened for display. */
export function bundleSummary(options: BundleOption[] | undefined, locale = 'en') {
  return (options || []).map(o => ({
    id: o.id,
    title: localized(o.title, locale),
    isRequired: o.isRequired,
    products: o.selections.map(s => ({ id: s.id, productId: s.productId, name: s.name, sku: s.sku }))
  }))
}

/**
 * Whether this product can hold a price of its own.
 *
 * A configurable parent cannot — the API answers 422 `not_sellable`, because
 * the prices belong to its variants. Asking first avoids showing that as an
 * error the user can do nothing about.
 */
export const isSellable = (p: VertexProduct | null) => !!p && p.type !== 'configurable'

/**
 * The API record as the screen's own view model.
 *
 * The template is ~1500 lines built around `DetailProduct`, so the record is
 * folded into that shape rather than the shape being replaced — the same
 * boundary-adapter the variant screen uses.
 */
export function toDetailView(
  p: VertexProduct,
  pricing: ProductPricing | null,
  locale = 'en'
): Record<string, unknown> {
  const e = toDetailEditable(p, locale)
  const category = (p.categories || [])[0]
  const plan = pricing?.default?.activePlan ?? null

  return {
    id: p.id,
    name: e.name,
    sku: e.sku,
    notes: e.notes,
    description: e.description,
    notForSale: e.notForSale,
    platformIds: e.platformIds,
    platformNames: (p.platforms || []).map(x => x.name),
    categoryId: category?.id,
    category: category?.name,
    categoryPath: category?.path,
    status: p.status === 'active' ? 'Active' : 'Inactive',
    stock: p.stockStatus,
    productType: p.type === 'configurable' ? 'variant' : (p.type === 'bundle' ? 'bundle' : 'single'),
    hasVariants: p.type === 'configurable',
    variantCount: (p.children || []).length,
    // read-only in this pass: the generator is a confirm-then-create flow of
    // its own, so the existing variants are shown as the API reports them
    variants: (p.children || []).map(c => ({
      name: (c.axisValues || []).map(a => a.label).join(' / '),
      sku: c.sku,
      price: c.priceFrom ?? '',
      stock: c.stockStatus,
      active: c.status === 'active',
      image: c.imageUrl ?? null
    })),
    // the editor reads `{ name, values }`; the API reports the attribute's
    // label and a `display` string it has already resolved from the option
    // ids, so the one is the name and the other the single value shown
    attributes: (p.attributes || []).map(a => ({
      name: a.label,
      values: a.display ? [a.display] : []
    })),
    pricing: plan
      ? [{
          version: 'current',
          isSubscription: !!p.isSubscription,
          monthly: monthlyFromLines(plan.lines),
          initial: plan.lines.filter(l => l.isPublished).reduce((t, l) => t + l.amount, 0),
          components: plan.lines
            .filter(l => l.lineType === 'fee' && l.feeItemId)
            .map(l => ({ feeId: l.feeItemId!, published: l.isPublished, amount: String(l.amount) })),
          active: true
        }]
      : [],
    overrides: {}
  }
}
