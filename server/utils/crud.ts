/**
 * Shared bodies for the per-resource route files, so each handler stays a
 * one-liner and every resource behaves identically (validation, 404, 422).
 */
import type { H3Event } from 'h3'
import type { ZodType } from 'zod'
import { listQuerySchema } from '#shared/schemas'

export async function listHandler<T>(event: H3Event, resource: string) {
  const query = await getValidatedQuery(event, listQuerySchema.parse)
  return backend().list<T>(resource, query)
}

export async function getHandler<T>(event: H3Event, resource: string) {
  const id = getRouterParam(event, 'id')
  if (!id) throw notFound(resource)
  return backend().get<T>(resource, id)
}

export async function createHandler<T>(event: H3Event, resource: string, schema: ZodType) {
  const body = await parseBody(event, schema)
  setResponseStatus(event, 201)
  return backend().create<T>(resource, body)
}

export async function updateHandler<T>(event: H3Event, resource: string, schema: ZodType) {
  const id = getRouterParam(event, 'id')
  if (!id) throw notFound(resource)
  const body = await parseBody(event, schema)
  return backend().update<T>(resource, id, body)
}

export async function removeHandler(event: H3Event, resource: string) {
  const id = getRouterParam(event, 'id')
  if (!id) throw notFound(resource)
  await backend().remove(resource, id)
  setResponseStatus(event, 204)
  return null
}

/** Validate a body, turning a ZodError into our 422 shape. */
export async function parseBody<T>(event: H3Event, schema: ZodType<T>): Promise<T> {
  try {
    return await readValidatedBody(event, schema.parse)
  } catch (err) {
    const fieldErrors = zodFieldErrors((err as { data?: unknown }).data ?? err)
    if (Object.keys(fieldErrors).length) {
      throw unprocessable('The given data was invalid.', fieldErrors)
    }
    throw unprocessable('The request body could not be read.')
  }
}
