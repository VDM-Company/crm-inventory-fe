/**
 * The contract between the Nuxt app and `server/api`.
 *
 * This is OUR shape, deliberately not Laravel's. `server/utils/backend.ts` is
 * the single place that translates whatever the upstream returns into these,
 * so swapping the placeholder for the real API is one file plus its mappers.
 */

/** A page of records. `meta` is null when the upstream does not paginate. */
export interface ApiList<T> {
  data: T[]
  meta: ApiListMeta | null
}

export interface ApiListMeta {
  page: number
  perPage: number
  total: number
  lastPage: number
}

/** Query accepted by every list endpoint. All optional. */
export interface ListQuery {
  page?: number
  perPage?: number
  /** free-text search; the upstream decides which columns it covers */
  q?: string
  sort?: string
  dir?: 'asc' | 'desc'
}

/** Per-field validation messages, shaped for Nuxt UI's UForm `errors`. */
export type FieldErrors = Record<string, string>

/**
 * The body of a failed response. Thrown via `createError({ data })`, so the
 * client reads it off `error.data`.
 */
export interface ApiErrorBody {
  message: string
  /** present on 422 only */
  fieldErrors?: FieldErrors
}

/** Which backend served the request — surfaced by `/api/_health`. */
export type ApiMode = 'mock' | 'proxy'
