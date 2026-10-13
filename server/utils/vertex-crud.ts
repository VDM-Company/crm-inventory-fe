/**
 * The route bodies every Vertex resource repeats, so each file in
 * `server/api/*` stays a one-liner.
 *
 * Mirrors the API's own shape rather than the older `crud.ts`: lists are
 * cursor-paginated, updates are PATCH, and a create answers 201.
 *
 * Extracted when platforms became the second resource — one example was not
 * yet a pattern, two are.
 */
import type { H3Event } from 'h3'
import type { ZodType } from 'zod'

/**
 * One page of a list, or the whole thing behind `?all=true`.
 *
 * `all` is for master data a screen renders in full. The synthesised meta says
 * there is nothing after it, because by then there genuinely is not.
 */
export async function vertexListHandler<T>(event: H3Event, path: string, schema: ZodType) {
  const query = await getValidatedQuery(event, schema.parse)
  const { all, ...rest } = query as Record<string, unknown>

  if (all) {
    const data = await vertex().all<T>(path, rest)
    return { data, meta: { nextCursor: null, prevCursor: null, total: data.length } }
  }
  return vertex().page<T>(path, rest)
}

export function vertexGetHandler<T>(event: H3Event, path: string, what: string) {
  const id = getRouterParam(event, 'id')
  if (!id) throw notFound(what)
  return vertex().one<T>(`${path}/${id}`)
}

export async function vertexCreateHandler<T>(event: H3Event, path: string, schema: ZodType) {
  const body = await parseBody(event, schema)
  const created = await vertex().one<T>(path, { method: 'POST', body })
  setResponseStatus(event, 201)
  return created
}

/**
 * PATCH, not PUT. The schema is expected to require `lockVersion`: the API
 * refuses a versioned update without it and answers 409 `stale_version` when
 * it is behind.
 */
export async function vertexUpdateHandler<T>(event: H3Event, path: string, schema: ZodType, what: string) {
  const id = getRouterParam(event, 'id')
  if (!id) throw notFound(what)
  const body = await parseBody(event, schema)
  return vertex().one<T>(`${path}/${id}`, { method: 'PATCH', body })
}

export async function vertexRemoveHandler(event: H3Event, path: string, what: string) {
  const id = getRouterParam(event, 'id')
  if (!id) throw notFound(what)
  await vertex().none(`${path}/${id}`, { method: 'DELETE' })
  setResponseStatus(event, 204)
}

/** A POST that acts on one record and returns it — `activate`, `restore`, … */
export function vertexActionHandler<T>(event: H3Event, path: string, action: string, what: string) {
  const id = getRouterParam(event, 'id')
  if (!id) throw notFound(what)
  return vertex().one<T>(`${path}/${id}/${action}`, { method: 'POST' })
}
