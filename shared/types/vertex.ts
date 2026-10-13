/**
 * The Vertex Commerce API contract.
 *
 * Every shape here is derived from the saved examples in
 * `docs/api/vertex-commerce.postman_collection.json` and from the conventions
 * its collection description states. Nothing has been checked against a live
 * backend, so treat a mismatch as the collection being newer, not as a bug in
 * the screens.
 *
 * Conventions this file encodes:
 * - Every success body is `{ data: … }`; lists add `meta`.
 * - Lists are cursor-paginated. `meta.total` only appears with
 *   `include_total=true`, which the API calls costly.
 * - Mutations on versioned resources carry `lock_version`; a mismatch is
 *   409 `stale_version`.
 * - Money is integer JPY. There are no minor units to divide by.
 * - Errors use one envelope, with per-field `errors` on 422.
 */

/** Text keyed by locale, e.g. `{ en: 'Base Price' }`. */
export type LocalizedText = Record<string, string>

export interface VertexEnvelope<T> {
  data: T
}

export interface VertexListMeta {
  /** Pass back as `cursor` to get the next page. Null on the last one. */
  nextCursor: string | null
  prevCursor: string | null
  /** Only present when the request asked for `include_total`. */
  total?: number
}

export interface VertexList<T> {
  data: T[]
  meta: VertexListMeta
}

/** Cursor paging. Deliberately not page/perPage — the API has no page numbers. */
export interface CursorQuery {
  cursor?: string | null
  limit?: number
  /** Costly upstream; ask only when the UI shows a count. */
  includeTotal?: boolean
}

// ── errors ──────────────────────────────────────────────────────────────────

/**
 * One field's failures on a 422. The key is not always a field on the form —
 * the API also reports list-level keys such as `lines`.
 */
export interface VertexFieldError {
  code: string
  message: string
}

export interface VertexErrorBody {
  error: {
    code: string
    message: string
    details?: Record<string, unknown>
  }
  errors?: Record<string, VertexFieldError[]>
}

/** 409 codes this app acts on. The API defines more. */
export type VertexConflictCode
  = | 'stale_version'
    | 'in_use'
    | 'system_fee_item'

// ── fee items ───────────────────────────────────────────────────────────────

/** `base` is seeded and exists once. `tax` and `shipping` are system rows too. */
export type FeeItemKind = 'base' | 'tax' | 'shipping' | 'other'

/**
 * A reusable price line item.
 *
 * `usageCount` is how many price lines reference it, history included — the
 * server counts it, so no screen needs to load products to work it out.
 * `isSystem` rows refuse deletion with 409 `system_fee_item`.
 */
export interface FeeItem {
  id: string
  /** 2–50 of `[a-z0-9_]`, unique; immutable once created. */
  code: string
  name: LocalizedText
  description: LocalizedText | null
  icon: string | null
  kind: FeeItemKind
  isSystem: boolean
  usageCount: number
  lockVersion: number
}

/** POST body. `code` and `kind` cannot be changed afterwards. */
export interface FeeItemDraft {
  code: string
  name: LocalizedText
  kind: FeeItemKind
  description?: LocalizedText | null
  icon?: string | null
}

/** PATCH body. `lockVersion` is required by the API, so it is required here. */
export interface FeeItemPatch {
  name?: LocalizedText
  description?: LocalizedText | null
  icon?: string | null
}

export interface FeeItemQuery extends CursorQuery {
  kind?: FeeItemKind
}
