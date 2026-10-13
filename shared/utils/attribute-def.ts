import type { Attribute, AttributeDef, AttributeInputType, AttributeOption } from '#shared/types'
import { localized } from './localized'

/**
 * Between the API's attribute and the flat shape the screens read.
 *
 * The product forms work on `AttributeDef` — `{ id, name, type, values }` —
 * through helpers like `attributeValuesFor` and `attributeAvailableFor`.
 * Converting here keeps those, so a screen that only reads attributes changes
 * one line.
 *
 * What is lost in the flattening: every option's id, its usage count and its
 * swatch. A screen that edits options reads the API record itself, because
 * writing them back needs those ids.
 */

/** The API's vocabulary, as the Attributes form shows it. */
const TYPE_LABELS: Record<AttributeInputType, string> = {
  dropdown: 'Dropdown',
  swatch: 'Swatch',
  radio: 'Radio',
  text: 'Text'
}

export const INPUT_TYPE_LABELS = TYPE_LABELS
/** Only these carry a list of values; `text` is free entry. */
export const OPTION_INPUT_TYPES: AttributeInputType[] = ['dropdown', 'swatch', 'radio']

export const inputTypeLabel = (t: AttributeInputType | string) =>
  TYPE_LABELS[t as AttributeInputType] ?? String(t)

export function labelToInputType(label: string): AttributeInputType {
  const hit = (Object.keys(TYPE_LABELS) as AttributeInputType[]).find(k => TYPE_LABELS[k] === label)
  return hit ?? 'dropdown'
}

export const optionLabels = (options: AttributeOption[] | undefined, locale = 'en') =>
  (options || []).map(o => localized(o.label, locale))

export function toAttributeDef(a: Attribute, locale = 'en'): AttributeDef {
  return {
    id: a.id,
    name: localized(a.label, locale),
    type: inputTypeLabel(a.inputType),
    values: optionLabels(a.options, locale)
  }
}

export const toAttributeDefs = (list: Attribute[], locale = 'en') =>
  list.map(a => toAttributeDef(a, locale))

// ── editing options ────────────────────────────────────────────────────────

/** A row of the option editor. `id` is null for one that has not been saved. */
export interface OptionRow {
  id: string | null
  label: string
}

export interface OptionChanges {
  /** Options the form no longer lists. Deleting a used one is 409 `in_use`. */
  removedIds: string[]
  /** Options whose label the form changed. */
  renamed: { id: string, label: string }[]
}

/**
 * What changed between the saved options and the rows on screen.
 *
 * The old form held plain strings and saved the whole array, so a rename was
 * indistinguishable from a delete plus an add. Here an option is a record with
 * an id that products reference, so the two have to be told apart: a rename
 * keeps every product that chose it, a delete-and-add does not.
 *
 * Additions are not listed — the caller creates them in row order and needs
 * each new id back to build the final ordering anyway.
 */
export function diffAttributeOptions(saved: AttributeOption[], rows: OptionRow[], locale = 'en'): OptionChanges {
  const keptIds = new Set(rows.map(r => r.id).filter(Boolean) as string[])
  const labelById = new Map(rows.filter(r => r.id).map(r => [r.id as string, r.label]))

  return {
    removedIds: (saved || []).filter(o => !keptIds.has(o.id)).map(o => o.id),
    renamed: (saved || [])
      .filter(o => labelById.has(o.id) && labelById.get(o.id) !== localized(o.label, locale))
      .map(o => ({ id: o.id, label: labelById.get(o.id)! }))
  }
}
