/**
 * The one seam between this app and the upstream API.
 *
 * `server/api/*` handlers only ever call `backend()`. While `apiBaseUrl` is
 * unset they get the in-memory mock; set it and the same calls go to Laravel.
 * Everything that is a guess about Laravel's wire format lives here, so
 * adapting to the real thing is this file plus the mappers below.
 */
import type { ApiList, ApiListMeta, ApiMode, ListQuery } from '#shared/types'
import { mockBackend } from './mock-db'

export interface Backend {
  mode: ApiMode
  list: <T>(resource: string, query?: ListQuery) => Promise<ApiList<T>>
  get: <T>(resource: string, id: string) => Promise<T>
  create: <T>(resource: string, body: unknown) => Promise<T>
  update: <T>(resource: string, id: string, body: unknown) => Promise<T>
  remove: (resource: string, id: string) => Promise<void>
  /** Singleton sub-resource, e.g. `platforms/p_sp/config`. */
  getRaw: <T>(path: string) => Promise<T>
  putRaw: <T>(path: string, body: unknown) => Promise<T>
}

// ── Laravel wire-format assumptions ──────────────────────────────────────────
// UNVERIFIED until the real API exists. Confirm each with the backend team:
//  1. API Resources wrap payloads in `{ data: ... }`.
//  2. Paginators add `{ meta: { current_page, last_page, per_page, total } }`.
//  3. Fields are snake_case, including query parameters (`per_page`).
//     Object keys that are IDs are exempt — see ID_KEYED_FIELDS.
//  4. Validation failures are 422 `{ message, errors: { field: [msg, ...] } }`.
// Each assumption is isolated in one function below.

type LaravelMeta = { current_page?: number, last_page?: number, per_page?: number, total?: number }
type LaravelEnvelope<T> = { data?: T, meta?: LaravelMeta }

function toMeta(meta: LaravelMeta | undefined): ApiListMeta | null {
  if (!meta || meta.current_page == null) return null
  return {
    page: Number(meta.current_page) || 1,
    perPage: Number(meta.per_page) || 0,
    total: Number(meta.total) || 0,
    lastPage: Number(meta.last_page) || 1
  }
}

const snakeToCamel = (k: string) => k.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase())
const camelToSnake = (k: string) => k.replace(/[A-Z]/g, c => '_' + c.toLowerCase())

/**
 * Fields whose object keys are IDs, not field names. Their keys must survive
 * untouched: `p_sp` would otherwise become `pSp` and every lookup would miss.
 * Values are still walked, so field names nested below are converted.
 */
const ID_KEYED_FIELDS = new Set(['overrides', 'scopes', 'positions', 'componentAmounts', 'component_amounts'])

function mapKeys(value: unknown, fn: (k: string) => string, keysAreIds = false): unknown {
  if (Array.isArray(value)) return value.map(v => mapKeys(v, fn, keysAreIds))
  if (value && typeof value === 'object' && (value as object).constructor === Object) {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[keysAreIds ? k : fn(k)] = mapKeys(v, fn, ID_KEYED_FIELDS.has(k))
    }
    return out
  }
  return value
}

/** Upstream -> our camelCase domain shape. */
export const fromUpstream = <T>(v: unknown): T => mapKeys(v, snakeToCamel) as T
/** Our shape -> upstream snake_case. */
export const toUpstream = (v: unknown): unknown => mapKeys(v, camelToSnake)

/** Re-throw an upstream failure as our own error body. */
function rethrow(err: unknown): never {
  const e = err as { status?: number, statusCode?: number, data?: { message?: string, errors?: Record<string, string[]> } }
  const status = e.status || e.statusCode || 502
  const body = e.data || {}
  if (status === 422 && body.errors) {
    const fieldErrors: Record<string, string> = {}
    for (const [k, msgs] of Object.entries(body.errors)) {
      const first = Array.isArray(msgs) ? msgs[0] : String(msgs)
      if (first) fieldErrors[snakeToCamel(k)] = first
    }
    throw unprocessable(body.message || 'The given data was invalid.', fieldErrors)
  }
  throw createError({
    statusCode: status,
    statusMessage: status === 502 ? 'Bad Gateway' : undefined,
    data: { message: body.message || 'Upstream request failed' }
  })
}

function proxyBackend(baseURL: string, token: string): Backend {
  const api = $fetch.create({
    baseURL,
    headers: {
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  })

  const call = async <T>(path: string, opts?: { method?: string, body?: unknown, query?: unknown }): Promise<T> => {
    try {
      const res = await api<LaravelEnvelope<T> | T>(path, {
        method: (opts?.method || 'GET') as 'GET',
        body: opts?.body === undefined ? undefined : (toUpstream(opts.body) as Record<string, unknown>),
        query: opts?.query as Record<string, unknown> | undefined
      })
      const unwrapped = (res && typeof res === 'object' && 'data' in (res as object))
        ? (res as LaravelEnvelope<T>).data
        : res
      return fromUpstream<T>(unwrapped)
    } catch (err) {
      rethrow(err)
    }
  }

  return {
    mode: 'proxy',
    async list<T>(resource: string, query?: ListQuery) {
      try {
        // ASSUMPTION: the upstream reads snake_case query params (`per_page`),
        // which is what Laravel's paginator uses.
        const res = await api<LaravelEnvelope<T[]>>(resource, { query: toUpstream(query) as Record<string, unknown> })
        return {
          data: fromUpstream<T[]>(res?.data ?? res) ?? [],
          meta: toMeta(res?.meta)
        }
      } catch (err) {
        rethrow(err)
      }
    },
    get: <T>(resource: string, id: string) => call<T>(`${resource}/${id}`),
    create: <T>(resource: string, body: unknown) => call<T>(resource, { method: 'POST', body }),
    update: <T>(resource: string, id: string, body: unknown) => call<T>(`${resource}/${id}`, { method: 'PUT', body }),
    remove: async (resource: string, id: string) => {
      await call<unknown>(`${resource}/${id}`, { method: 'DELETE' })
    },
    getRaw: <T>(path: string) => call<T>(path),
    putRaw: <T>(path: string, body: unknown) => call<T>(path, { method: 'PUT', body })
  }
}

let announced = false

/** Resolve the backend for this request. */
export function backend(): Backend {
  const cfg = useRuntimeConfig()
  const baseURL = String(cfg.apiBaseUrl || '')
  if (!announced) {
    announced = true
    console.info(baseURL
      ? `[api] proxy mode -> ${baseURL}`
      : '[api] mock mode (in-memory; set NUXT_API_BASE_URL to proxy to Laravel)')
  }
  return baseURL ? proxyBackend(baseURL, String(cfg.apiToken || '')) : mockBackend()
}
