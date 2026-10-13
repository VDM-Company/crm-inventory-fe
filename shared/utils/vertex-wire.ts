import type { VertexErrorBody, VertexFieldError, VertexListMeta } from '#shared/types'

/**
 * The pure half of the Vertex Commerce seam: case mapping, list meta, and the
 * error envelope.
 *
 * Here rather than in `server/utils/vertex.ts` so the tests exercise the code
 * that runs, not a copy of it. An earlier version of this did live in the
 * server module with the tests re-implementing it alongside, and the two could
 * have drifted apart without a single test noticing.
 */

export const snakeToCamel = (k: string) => k.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase())
export const camelToSnake = (k: string) => k.replace(/[A-Z]/g, c => '_' + c.toLowerCase())

/**
 * Fields whose object keys are data, not field names, so they pass through the
 * case mapper untouched: localized text is keyed by locale, and a locale
 * written `pt_br` must not become `ptBr`.
 *
 * `details` on an error is deliberately NOT here. Its keys (`lock_version`,
 * `usage_count`) are field names the screens read camelCased like any other.
 */
export const DATA_KEYED_FIELDS = new Set([
  'name', 'label', 'description', 'alt', 'title', 'valueText', 'value_text',
  // a product attribute's free-text value arrives as `value: { en: … }`
  'value'
])

function mapKeys(value: unknown, fn: (k: string) => string, keysAreData = false): unknown {
  if (Array.isArray(value)) return value.map(v => mapKeys(v, fn, keysAreData))
  if (value === null || typeof value !== 'object') return value
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[keysAreData ? k : fn(k)] = mapKeys(v, fn, keysAreData || DATA_KEYED_FIELDS.has(k))
  }
  return out
}

/** Upstream snake_case -> the app's camelCase. */
export const fromVertex = <T>(v: unknown): T => mapKeys(v, snakeToCamel) as T
/** The app's shape -> upstream snake_case. */
export const toVertex = (v: unknown): unknown => mapKeys(v, camelToSnake)

/**
 * `meta` as the API sends it -> the app's cursor meta.
 *
 * Anything beyond the cursors and `total` is carried through case-mapped
 * rather than dropped: each list adds its own extras — `scope` on a
 * category's products, `facets` elsewhere — and a reader that silently lost
 * them would look like the API had stopped sending them.
 */
export function toListMeta(meta: unknown): VertexListMeta {
  const { next_cursor: next, prev_cursor: prev, total, ...extras }
    = (meta || {}) as Record<string, unknown>

  return {
    ...fromVertex<Record<string, unknown>>(extras),
    nextCursor: (next as string | null) ?? null,
    prevCursor: (prev as string | null) ?? null,
    ...(total == null ? {} : { total: Number(total) })
  }
}

export interface VertexErrorData {
  message: string
  code: string
  details?: Record<string, unknown>
  fieldErrors: Record<string, string>
}

/**
 * Flatten the API's error envelope into what the screens read.
 *
 * `fieldErrors` keeps one message per key so it can go straight to UForm's
 * `errors` prop. `code` and `details` ride along because the screens need
 * them: 409 `in_use` carries `details.usageCount`, and `stale_version` carries
 * the `lockVersion` the caller should have sent.
 *
 * The keys of `errors` are not always form fields — the API also reports
 * list-level keys such as `lines`.
 */
export function vertexErrorData(body: VertexErrorBody | undefined): VertexErrorData {
  const envelope = body?.error

  const fieldErrors: Record<string, string> = {}
  for (const [k, list] of Object.entries(body?.errors || {})) {
    const first = (list as VertexFieldError[])?.[0]
    if (first?.message) fieldErrors[snakeToCamel(k)] = first.message
  }

  return {
    message: envelope?.message || 'Upstream request failed',
    code: envelope?.code || 'upstream_error',
    details: envelope?.details ? fromVertex(envelope.details) : undefined,
    fieldErrors
  }
}

/** Drops undefined, null and '' so an unset filter is not sent as `?kind=`. */
export function cleanQuery(query?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!query) return undefined
  const entries = Object.entries(toVertex(query) as Record<string, unknown>)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
  return entries.length ? Object.fromEntries(entries) : undefined
}
