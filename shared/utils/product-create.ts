import type {
  Attribute,
  BundleOptionsDraft,
  LocalizedText,
  VariantAxis,
  VariantCombination,
  VertexProductDraft,
  VertexProductType
} from '#shared/types'
import { localized } from './localized'

/**
 * The pure half of the Create Product screen.
 *
 * Creating a product is not one call. The API spells out the order itself:
 *
 * 1. `POST /admin/products` — product data only, always as a Draft;
 * 2. `POST /admin/products/{id}/price-plans` — the price (for a configurable,
 *    one plan per variant, since the parent is not sellable);
 * 3. `POST /admin/products/{id}/status` — `active`, which is rejected until
 *    every sellable product in the set has a Default price.
 *
 * Only the first step is a pure mapping, and this is it. The sequencing lives
 * in the page, because only it can decide what to do when step 2 fails after
 * step 1 has already created something.
 *
 * The mapping is worth testing on its own because nothing else can check it:
 * the Postman mock ignores request bodies entirely, so a wrong key name goes
 * through it and comes back 201.
 */

/** The screen's three product types, which are not the API's three. */
export type FormProductType = 'single' | 'variant' | 'bundle'

const API_TYPE: Record<FormProductType, VertexProductType> = {
  single: 'simple',
  // A product with variants is created as `configurable` and carries its
  // combinations in the same call. There is no `variant` type: that is what
  // the API calls each child.
  variant: 'configurable',
  bundle: 'bundle'
}

export const toApiProductType = (t: FormProductType): VertexProductType => API_TYPE[t] ?? 'simple'

/**
 * The form's stock value in the API's words.
 *
 * The form has said `out_stock` since the design; the API says
 * `out_of_stock`. It is a string VALUE, so the case mapper never touches it —
 * sending the form's spelling would be an enum the API does not have.
 */
export const toApiStockStatus = (stock: string): string =>
  stock === 'out_stock' ? 'out_of_stock' : stock

/** A localized field, left out entirely when the form left it blank. */
const text = (v: string | null | undefined): LocalizedText | undefined => {
  const s = (v ?? '').trim()
  return s === '' ? undefined : { en: s }
}

/** What the form holds, in the form's own words. */
export interface CreateFormInput {
  name: string
  sku: string
  notes: string
  description: string
  categoryId: string
  platformIds: string[]
  productType: FormProductType
  /** The form's own spelling: `in_stock` or `out_stock`. */
  stock: string
  isSubscription: boolean
  /** The form's "Not for sale" switch, which the API calls `isGift`. */
  notForSale: boolean
}

/**
 * The form as a create body.
 *
 * `status` is never sent: the API only accepts `draft` here and that is the
 * default, so saying it adds a field that can only be wrong. Publishing is
 * step 3.
 *
 * `requiresShipping` is not sent either — the form has no control for it, and
 * it locks once the product leaves Draft. ASSUMPTION: the API's default is
 * the right one. Worth confirming, because it also decides whether a Shipping
 * fee line is allowed (422 `shipping_not_allowed`).
 *
 * The attribute rows on this screen are variant axes, not product attributes:
 * they describe the matrix, so they go in `variants`, never in `attributes`.
 */
export function toProductDraft(
  input: CreateFormInput,
  variants?: { axes: VariantAxis[], combinations?: VariantCombination[] }
): VertexProductDraft {
  const name = text(input.name) ?? { en: 'Untitled Product' }
  const sku = input.sku.trim()
  const draft: VertexProductDraft = {
    type: toApiProductType(input.productType),
    name,
    isSubscription: !!input.isSubscription,
    isGift: !!input.notForSale
  }
  if (sku) draft.sku = sku
  const description = text(input.description)
  if (description) draft.description = description
  const notes = input.notes.trim()
  if (notes) draft.notes = notes
  // A configurable parent computes its stock from its variants and refuses
  // the field outright (422 `stock_status_computed`).
  if (input.productType !== 'variant' && input.stock) draft.stockStatus = toApiStockStatus(input.stock)
  if (input.categoryId) draft.categoryIds = [input.categoryId]
  if (input.platformIds.length) draft.platformIds = [...input.platformIds]
  if (variants && variants.axes.length) draft.variants = variants
  return draft
}

// ── variant axes ────────────────────────────────────────────────────────────

/** An attribute row of the form: a name and the value labels chosen on it. */
export interface AttributeRowInput {
  name: string
  values: string[]
}

export interface AxisResolution {
  axes: VariantAxis[]
  /**
   * Rows and values the attribute list has no id for, as
   * `Attribute` or `Attribute / Value`. Non-empty means the matrix cannot be
   * sent: an axis the API cannot resolve is 422 at best, and silently
   * dropping it would create the wrong set of variants.
   */
  unresolved: string[]
}

/**
 * The attribute rows as axes the API understands.
 *
 * The form works in labels — "Color", "Black" — because that is what the
 * screen shows. The API works in ids. `toAttributeDefs` flattens the option
 * ids away, so this reads the attribute records themselves; a screen that
 * only renders attributes can keep using the flat defs.
 */
export function resolveAxes(
  attributes: Attribute[],
  rows: AttributeRowInput[],
  locale = 'en'
): AxisResolution {
  const axes: VariantAxis[] = []
  const unresolved: string[] = []

  for (const row of rows) {
    const name = (row.name || '').trim()
    if (!name || !row.values.length) continue

    const attr = attributes.find(a => localized(a.label, locale) === name)
    if (!attr) {
      unresolved.push(name)
      continue
    }

    const optionIds: string[] = []
    for (const value of row.values) {
      const option = (attr.options || []).find(o => localized(o.label, locale) === value)
      if (option) optionIds.push(option.id)
      else unresolved.push(`${name} / ${value}`)
    }
    if (optionIds.length) axes.push({ attributeId: attr.id, optionIds })
  }

  return { axes, unresolved }
}

/** A row of the variant table. `key` is its labels joined by ` / `. */
export interface VariantRowInput {
  key: string
  sku: string
}

/**
 * The variant rows as combinations.
 *
 * A row's `key` is the value labels in axis order, which is how the screen
 * built it; this turns each label back into the option id of the matching
 * axis. A row whose labels do not resolve is reported rather than dropped —
 * generating a different set of variants than the table showed would be worse
 * than refusing to save.
 *
 * A SKU is sent only when the row has one; without it the API generates
 * `{PARENT SKU}-{OPTION CODE}-…` itself.
 */
export function resolveCombinations(
  attributes: Attribute[],
  axes: VariantAxis[],
  rows: VariantRowInput[],
  locale = 'en'
): { combinations: VariantCombination[], unresolved: string[] } {
  // option id by axis position and label, so a label that exists on two axes
  // still resolves to the right one
  const byAxis = axes.map((axis) => {
    const attr = attributes.find(a => a.id === axis.attributeId)
    const map = new Map<string, string>()
    for (const id of axis.optionIds) {
      const option = (attr?.options || []).find(o => o.id === id)
      if (option) map.set(localized(option.label, locale), id)
    }
    return map
  })

  const combinations: VariantCombination[] = []
  const unresolved: string[] = []

  for (const row of rows) {
    const labels = row.key.split(' / ')
    if (labels.length !== axes.length) {
      unresolved.push(row.key)
      continue
    }
    const optionIds: string[] = []
    let ok = true
    labels.forEach((label, i) => {
      const id = byAxis[i]?.get(label)
      if (id) optionIds.push(id)
      else ok = false
    })
    if (!ok) {
      unresolved.push(row.key)
      continue
    }
    const sku = (row.sku || '').trim()
    combinations.push(sku ? { optionIds, sku } : { optionIds })
  }

  return { combinations, unresolved }
}

// ── bundle contents ─────────────────────────────────────────────────────────

/** A bundle component of the form: a title and the products it offers. */
export interface BundleComponentInput {
  name: string
  products: { id: string }[]
}

/**
 * The bundle components as a `bundle-options` body.
 *
 * ASSUMPTIONS, both because the form has no control for either:
 * - `inputType` is `radio`, matching the screen, where a component offers a
 *   choice of one product.
 * - the first product is the default. Marking more than one would be 422
 *   `default_conflict` on a radio.
 *
 * No `id` is sent on anything: this builds the contents of a product that
 * does not exist yet, so there are no selections to keep prices attached to.
 */
export function toBundleOptionsDraft(components: BundleComponentInput[]): BundleOptionsDraft {
  return {
    options: components
      .filter(c => (c.name || '').trim() && c.products.some(p => p.id))
      .map(c => ({
        title: { en: c.name.trim() },
        inputType: 'radio',
        isRequired: true,
        selections: c.products
          .filter(p => p.id)
          .map((p, i) => (i === 0 ? { productId: p.id, isDefault: true } : { productId: p.id }))
      }))
  }
}
