/**
 * Typed client for `server/api`.
 *
 * The screens call the `app/utils/*` stores for reads (`loadProducts()`,
 * `loadCategories()`, …) and the mutation helpers here for writes. Both go
 * through `/api`; no page touches localStorage any more.
 *
 * Reads happen in `onMounted` via `$fetch`, which keeps the existing
 * render-then-fill behaviour and avoids a hydration mismatch. `useApiList` /
 * `useApiItem` are the SSR-aware alternative, unused so far.
 */
import type { ApiList, FieldErrors, ListQuery } from '#shared/types'

type MaybeRefDeep<T> = T | Ref<T> | (() => T)

/** GET a collection. Pass a getter or ref for `query` to make it reactive. */
export function useApiList<T>(resource: string, query?: MaybeRefDeep<ListQuery>) {
  return useFetch<ApiList<T>>(() => `/api/${resource}`, {
    query: query as Record<string, unknown>,
    default: () => ({ data: [], meta: null })
  })
}

/** GET one record. */
export function useApiItem<T>(resource: string, id: MaybeRefDeep<string>) {
  return useFetch<T>(() => `/api/${resource}/${toValue(id as Ref<string>)}`)
}

export function apiCreate<T>(resource: string, body: unknown) {
  return $fetch<T>(`/api/${resource}`, { method: 'POST', body: body as Record<string, unknown> })
}

export function apiUpdate<T>(resource: string, id: string, body: unknown) {
  return $fetch<T>(`/api/${resource}/${id}`, { method: 'PUT', body: body as Record<string, unknown> })
}

export function apiRemove(resource: string, id: string) {
  return $fetch(`/api/${resource}/${id}`, { method: 'DELETE' })
}

/** Read a singleton sub-resource, e.g. `platforms/p_sp/config`. */
export function apiGetRaw<T>(path: string) {
  return $fetch<T>(`/api/${path}`)
}

export function apiPutRaw<T>(path: string, body: unknown) {
  return $fetch<T>(`/api/${path}`, { method: 'PUT', body: body as Record<string, unknown> })
}

/**
 * Pull `fieldErrors` off a failed request so they can go straight into
 * UForm's `errors` prop. Returns `{}` for anything that is not a 422.
 */
export function apiFieldErrors(err: unknown): FieldErrors {
  const data = (err as { data?: { data?: { fieldErrors?: FieldErrors }, fieldErrors?: FieldErrors } })?.data
  return data?.data?.fieldErrors ?? data?.fieldErrors ?? {}
}

/** Human-readable message from a failed request. */
export function apiErrorMessage(err: unknown, fallback = 'Something went wrong.'): string {
  const data = (err as { data?: { data?: { message?: string }, message?: string } })?.data
  return data?.data?.message ?? data?.message ?? fallback
}
