import type { AuditLogEntry } from '#shared/types'
import { localized } from './localized'

/**
 * The audit log as the Version History drawer reads it.
 *
 * The drawer used to render `seedHistory()` — invented entries attributed to
 * "Olivia Rhye" and "Phoenix Baker", shown on every product whatever had
 * actually happened to it.
 *
 * The work here is the diff. `changes.before` and `changes.after` are
 * snapshots, not a diff: an `updated` entry repeats every field whether it
 * moved or not. The collection's own example carries fourteen keys of which
 * exactly one changed, so listing them would bury the one thing the reader
 * came for.
 */

/** One line of the drawer: `Field: old → new`. */
export interface HistoryChange {
  field: string
  from: string
  to: string
}

export interface HistoryEntry {
  id: string
  actor: string
  ts: number
  changes: HistoryChange[]
}

/** Names the humaniser gets wrong, or that have a word the screen uses. */
const FIELD_LABELS: Record<string, string> = {
  sku: 'SKU',
  isGift: 'Not for sale',
  isSubscription: 'Subscription',
  requiresShipping: 'Requires shipping',
  stockStatus: 'Stock',
  categoryIds: 'Categories',
  platformIds: 'Platforms',
  platformId: 'Platform',
  resetAttributeIds: 'Reset attributes',
  lockVersion: 'Version',
  parentId: 'Parent product'
}

/** `platformIds` → `Platform ids`, as a last resort. */
function humanize(key: string): string {
  const spaced = key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/_/g, ' ').trim()
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase()
}

export const fieldLabel = (key: string) => FIELD_LABELS[key] ?? humanize(key)

/** `product_platform_content_updated` → `Platform content updated`. */
export function actionLabel(action: string): string {
  const cleaned = (action || '').replace(/^product_/, '').replace(/_/g, ' ').trim()
  if (!cleaned) return 'Changed'
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
}

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

/** A localized map is an object whose every value is a string, e.g. `{en: …}`. */
const isLocalized = (v: unknown): v is Record<string, string> =>
  isPlainObject(v) && Object.keys(v).length > 0 && Object.values(v).every(x => typeof x === 'string')

/** A UUID-ish string: something nobody wants to read on screen. */
const looksLikeId = (v: unknown) =>
  typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)

/**
 * Turns an id into something readable, when the caller can.
 *
 * The screens already hold the platform and category lists, so a row that
 * would otherwise read `3 items → 2 items` can name what went. Optional
 * because this module stays pure — it looks nothing up itself.
 */
export type LabelLookup = (id: string) => string | undefined

/**
 * One snapshot value as a line of text.
 *
 * Deliberately lossy. This is a history drawer, not a data viewer: the reader
 * wants to see THAT the images changed, not a dump of every path. A list of
 * records therefore becomes a count.
 *
 * Ids are never printed raw. Two UUIDs side by side are unreadable, and
 * worse, the old rule printed them on one side while the other said
 * "3 items" — two halves of a comparison that could not be compared.
 */
export function formatValue(value: unknown, label?: LabelLookup): string {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'number') return String(value)
  if (typeof value === 'string') {
    return looksLikeId(value) ? (label?.(value) ?? 'an item') : value
  }

  if (Array.isArray(value)) {
    if (!value.length) return 'none'
    if (value.every(v => typeof v === 'string' || typeof v === 'number')) {
      const named = value.map(v => (looksLikeId(v) ? label?.(String(v)) : String(v)))
      // only name them when every one resolves; a half-named list is worse
      // than an honest count
      if (named.every(Boolean)) return named.join(', ')
      return `${value.length} items`
    }
    return `${value.length} items`
  }

  if (isLocalized(value)) return localized(value as Record<string, string>)
  return `${Object.keys(value as Record<string, unknown>).length} fields`
}

const sameValue = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)

/**
 * What actually moved between two snapshots.
 *
 * Keys are the union of both sides: `before` is often partial — the
 * collection's platform-content entry carries only `platformId` there while
 * `after` carries four fields — so iterating one side would miss the rest.
 */
export function diffSnapshots(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown> | null | undefined,
  label?: LabelLookup
): HistoryChange[] {
  const a = before || {}
  const b = after || {}
  const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()

  const out: HistoryChange[] = []
  for (const key of keys) {
    if (sameValue(a[key], b[key])) continue
    out.push({ field: fieldLabel(key), from: formatValue(a[key], label), to: formatValue(b[key], label) })
  }
  return out
}

/**
 * The log as the drawer's entries.
 *
 * An entry whose snapshots differ in nothing still gets a line — it happened,
 * and saying so is better than an entry that renders blank. That line carries
 * the action instead of a field, with no `from`/`to` for the template to
 * draw an arrow between.
 */
export function toHistoryEntries(
  logs: AuditLogEntry[] | null | undefined,
  label?: LabelLookup
): HistoryEntry[] {
  return (logs || []).map((log) => {
    const changes = diffSnapshots(log.changes?.before, log.changes?.after, label)
    return {
      id: log.id,
      // `actor.type` is `user` in every example, but a system actor has no
      // name and "undefined" must not reach the screen
      actor: log.actor?.name || (log.actor?.type === 'system' ? 'System' : 'Unknown'),
      ts: Date.parse(log.createdAt) || 0,
      changes: changes.length ? changes : [{ field: actionLabel(log.action), from: '', to: '' }]
    }
  })
}
