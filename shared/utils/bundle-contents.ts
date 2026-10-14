import type { BundleOption, BundleOptionsDraft } from '#shared/types'
import { localized } from './localized'

/**
 * The pure half of editing a bundle's contents.
 *
 * `saveBundleOptions` is a PUT: it replaces everything. The contract that
 * decides this whole file is one sentence of it — *ids that already belong to
 * the bundle are kept, and keep the in-bundle prices attached to them;
 * anything else is given a new id.*
 *
 * So an editor that forgets an id does not fail. It succeeds, silently, and
 * the price someone set for that choice is gone. Every shape here therefore
 * carries `id` from the moment it is read to the moment it is sent, and a
 * selection that genuinely disappears is reported so it can be confirmed
 * rather than discovered later.
 */

/** One choice inside an option. `id` is absent only on a row just added. */
export interface BundleSelectionRow {
  id?: string
  productId: string
  name: string
  sku: string
  isDefault: boolean
  maxQty: number
}

export interface BundleOptionRow {
  id?: string
  /** Stable across edits, so a list render does not key on the index. */
  key: string
  title: string
  inputType: string
  isRequired: boolean
  selections: BundleSelectionRow[]
}

/** Options that take exactly one choice, so only one may be the default. */
const SINGLE_CHOICE = new Set(['radio', 'dropdown'])

/** The API's options as editable rows, ids intact. */
export function toBundleEditor(options: BundleOption[] | null | undefined, locale = 'en'): BundleOptionRow[] {
  return (options || []).map((o, i) => ({
    id: o.id,
    key: o.id || `new:${i}`,
    title: localized(o.title, locale),
    inputType: o.inputType || 'radio',
    isRequired: o.isRequired !== false,
    selections: (o.selections || []).map(s => ({
      id: s.id,
      productId: s.productId,
      name: s.name,
      sku: s.sku,
      isDefault: !!s.isDefault,
      maxQty: s.maxQty ?? 1
    }))
  }))
}

/**
 * The rows as a PUT body.
 *
 * `id` is sent wherever there is one — that is the whole point. A row added
 * in this session has none, and the API assigns it one.
 */
export function toBundleDraft(rows: BundleOptionRow[], lockVersion?: number): BundleOptionsDraft {
  return {
    options: rows
      .filter(o => o.title.trim() && o.selections.some(s => s.productId))
      .map(o => ({
        ...(o.id ? { id: o.id } : {}),
        title: { en: o.title.trim() },
        inputType: o.inputType,
        isRequired: o.isRequired,
        selections: o.selections
          .filter(s => s.productId)
          .map(s => ({
            ...(s.id ? { id: s.id } : {}),
            productId: s.productId,
            isDefault: s.isDefault,
            maxQty: s.maxQty
          }))
      })),
    ...(lockVersion === undefined ? {} : { lockVersion })
  }
}

/** Something the save would drop, and what dropping it costs. */
export interface BundleRemoval {
  kind: 'option' | 'selection'
  label: string
  sku?: string
}

/**
 * What this save removes.
 *
 * Only rows that HAD an id can be removed in any meaningful sense — they are
 * the ones the API knows about, and the only ones carrying an in-bundle
 * price. A row added and deleted in the same session costs nothing and is
 * not worth reporting.
 */
export function bundleRemovals(before: BundleOptionRow[], after: BundleOptionRow[]): BundleRemoval[] {
  const keptOptions = new Set(after.map(o => o.id).filter(Boolean))
  const keptSelections = new Set(after.flatMap(o => o.selections.map(s => s.id)).filter(Boolean))

  const out: BundleRemoval[] = []
  for (const o of before) {
    if (o.id && !keptOptions.has(o.id)) {
      out.push({ kind: 'option', label: o.title })
      continue
    }
    for (const s of o.selections) {
      if (s.id && !keptSelections.has(s.id)) {
        out.push({ kind: 'selection', label: `${o.title} — ${s.name}`, sku: s.sku })
      }
    }
  }
  return out
}

/**
 * Why this cannot be saved, or null.
 *
 * Each of these is a 422 the API would answer, checked here so the reader is
 * told in their own words instead of through an error code.
 */
export function bundleBlockedReason(rows: BundleOptionRow[]): string | null {
  const filled = rows.filter(o => o.title.trim())
  if (!filled.length) return 'A bundle needs at least one component.'

  for (const o of filled) {
    const chosen = o.selections.filter(s => s.productId)
    // 422 `option_required`
    if (!chosen.length) return `“${o.title}” has no products. Add one, or remove the component.`

    // 422 `duplicate_product`
    const ids = chosen.map(s => s.productId)
    if (new Set(ids).size !== ids.length) return `“${o.title}” lists the same product twice.`

    // 422 `default_conflict`
    if (SINGLE_CHOICE.has(o.inputType) && chosen.filter(s => s.isDefault).length > 1) {
      return `“${o.title}” lets the customer pick one, so only one product can be the default.`
    }
  }

  const titles = filled.map(o => o.title.trim().toLowerCase())
  if (new Set(titles).size !== titles.length) return 'Two components have the same name.'

  return null
}

/** Whether anything about the contents moved. */
export function bundleChanged(before: BundleOptionRow[], after: BundleOptionRow[]): boolean {
  const key = (rows: BundleOptionRow[]) => JSON.stringify(
    rows.map(o => ({
      id: o.id ?? null,
      title: o.title.trim(),
      inputType: o.inputType,
      isRequired: o.isRequired,
      selections: o.selections
        .filter(s => s.productId)
        .map(s => ({ id: s.id ?? null, productId: s.productId, isDefault: s.isDefault, maxQty: s.maxQty }))
    }))
  )
  return key(before) !== key(after)
}
