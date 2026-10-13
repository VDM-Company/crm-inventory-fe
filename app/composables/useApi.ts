/**
 * Typed client for `server/api`.
 *
 * What is left here after the resource bindings took over CRUD: the two error
 * readers every screen uses, the `*Raw` helpers for the sub-resources that are
 * not CRUD (`platforms/:id/config`, `categories/:id/products`), and the
 * SSR-aware `useApiList` / `useApiItem`, which nothing calls yet.
 *
 * Every resource now reads and writes through its own `useApiX()` — see
 * `useApiResource.ts` and the bindings beside it. Reads happen in `onMounted`
 * via `$fetch`, which keeps the render-then-fill behaviour and avoids a
 * hydration mismatch.
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
