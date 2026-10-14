/**
 * The seam between this app and the Vertex Commerce API.
 *
 * It replaced `backend.ts`, which spoke the shape this app was built against
 * before the real contract existed — page numbers, PUT, no `lock_version`.
 * The screens moved here one resource at a time, and that file and its
 * in-memory mock went with the last of them.
 *
 * This module is the half that cannot be pure: configuration, the bearer
 * token, the HTTP call, and turning a failure into an h3 error. The wire
 * translation itself lives in `#shared/utils/vertex-wire` and the cursor walk
 * in `#shared/utils/cursor`, so both are tested directly rather than through a
 * copy of themselves.
 *
 * Built from `docs/api/vertex-commerce.postman_collection.json`. Unverified
 * against a live backend.
 */
import type { H3Event } from 'h3'
import type { VertexErrorBody, VertexList } from '#shared/types'
import { CursorNotTerminated, walkCursor } from '#shared/utils/cursor'
import { isSessionEnding } from '#shared/utils/auth'
import { cleanQuery, fromVertex, toListMeta, toVertex, vertexErrorData } from '#shared/utils/vertex-wire'

/**
 * Turn an upstream failure into the `createError` shape the screens read.
 *
 * The flattening is `vertexErrorData`; this only carries it into h3.
 */
export function vertexError(err: unknown): never {
  const e = err as { status?: number, statusCode?: number, data?: VertexErrorBody }
  const data = vertexErrorData(e.data)

  throw createError({
    statusCode: e.status || e.statusCode || 502,
    statusMessage: data.code,
    data
  })
}

interface CallOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  body?: unknown
  query?: Record<string, unknown>
  /** Required by the API on bulk operations and variant generation. */
  idempotencyKey?: string
}

/**
 * The upstream client, authenticated as whoever is making THIS request.
 *
 * `event` is required rather than optional on purpose: the token used to come
 * from a single static `NUXT_VERTEX_API_TOKEN`, which meant every visitor —
 * signed in or not — acted as the same privileged account. Taking the event
 * makes the compiler name every call site that has to say whose request it
 * is, and leaves nowhere for a shared credential to hide.
 *
 * Pass `{ token }` to call as someone who has no session yet. Only the login
 * route needs that, and it passes no token at all.
 */
export function vertex(event: H3Event, auth?: { token?: string }) {
  const config = useRuntimeConfig()
  const baseURL = config.vertexApiBase as string

  if (!baseURL) {
    throw createError({
      statusCode: 503,
      statusMessage: 'vertex_api_unconfigured',
      data: { message: 'NUXT_VERTEX_API_BASE is not set, so there is no upstream to call.' }
    })
  }

  // One instance so the base URL and the bearer token are set in a single
  // place rather than on every call. The token is read per call rather than
  // captured, because the login route creates the session mid-request.
  async function authHeaders(): Promise<Record<string, string>> {
    const token = auth ? auth.token : await sessionToken(event)
    return token ? { Authorization: `Bearer ${token}` } : {}
  }

  async function call<T>(path: string, opts: CallOptions = {}): Promise<T> {
    const api = $fetch.create({
      baseURL,
      headers: { Accept: 'application/json', ...(await authHeaders()) }
    })
    try {
      return await api(path, {
        method: (opts.method || 'GET') as 'GET',
        headers: opts.idempotencyKey ? { 'Idempotency-Key': opts.idempotencyKey } : undefined,
        query: cleanQuery(opts.query),
        body: opts.body === undefined ? undefined : (toVertex(opts.body) as Record<string, unknown>)
      }) as T
    } catch (err) {
      // A token the upstream no longer accepts — revoked, or expired.
      // Clearing the session here is what stops a signed-in-looking user
      // from watching every screen fail.
      //
      // By CODE, not by status. Not every 401 means the session is over, and
      // clearing on all of them logged people out whenever they saved a
      // price: the Postman mock answers that write with its saved 401, whose
      // code is the literal string `"string"`.
      const e = err as { status?: number, statusCode?: number, data?: VertexErrorBody }
      const status = e.status || e.statusCode
      if (!auth && status === 401 && isSessionEnding(e.data?.error?.code)) {
        await clearUserSession(event)
      }
      vertexError(err)
    }
  }

  return {
    /** One record. Unwraps `{ data }`. */
    async one<T>(path: string, opts: CallOptions = {}): Promise<T> {
      const res = await call<{ data: unknown }>(path, opts)
      return fromVertex<T>(res?.data)
    },

    /** One page of a list, with its cursors. */
    async page<T>(path: string, query?: Record<string, unknown>): Promise<VertexList<T>> {
      const res = await call<{ data: unknown[], meta?: unknown }>(path, { query })
      return { data: fromVertex<T[]>(res?.data ?? []), meta: toListMeta(res?.meta) }
    },

    /**
     * Every page, following `next_cursor`.
     *
     * For master data that a screen renders in full — fee items, attributes,
     * platforms. Products must not use this; that list is unbounded and the
     * screen pages it.
     *
     * The walk itself is `walkCursor`, which is pure and tested on its own;
     * this only turns its give-up into the 502 the screens read.
     */
    async all<T>(path: string, query?: Record<string, unknown>, maxPages = 20): Promise<T[]> {
      try {
        return await walkCursor<T>(async (cursor) => {
          const res = await this.page<T>(path, { ...query, cursor })
          return { data: res.data, nextCursor: res.meta.nextCursor }
        }, maxPages)
      } catch (err) {
        if (!(err instanceof CursorNotTerminated)) throw err
        throw createError({
          statusCode: 502,
          statusMessage: 'cursor_did_not_terminate',
          data: { message: `${path}: ${err.message}` }
        })
      }
    },

    /** No body comes back on a 204. */
    async none(path: string, opts: CallOptions = {}): Promise<void> {
      await call<unknown>(path, opts)
    }
  }
}
