import type { ApiList, Draft, ListQuery, Persisted } from '#shared/types'

/**
 * A typed client for one `server/api` resource.
 *
 * Replaces passing the resource name as a string to generic helpers: the name
 * is written once per resource, and the record type travels with it, so
 * `apiCreate<Category>('products', …)` stops being something TypeScript will
 * happily accept.
 *
 * Reads and writes only — loading and error state belong to the caller, and
 * the pure helpers over an already-loaded list stay in `app/utils/*`.
 *
 * Bind it to a resource in its own `useApiX.ts` file (see `useApiProducts.ts`)
 * rather than calling it inline, so each resource has one place to hang the
 * endpoints that are not plain CRUD.
 *
 * The second type parameter on `get` / `create` / `update` lets a caller work
 * with a shape of its own instead of `T`. It governs the body as well as the
 * return, so a screen with its own view model sends and receives that model
 * instead of casting. It is deliberately unconstrained, and so is an unchecked
 * assertion — `get<Whatever>(id)` compiles. `<R extends T>` would be safer but
 * does not compile today; the resource bindings that rely on this say why.
 */
export function useApiResource<T>(resource: string) {
  const base = `/api/${resource}`
  const body = (v: unknown) => v as Record<string, unknown>

  return {
    /** The rows only. Use `page()` when the pagination metadata matters. */
    list: (query?: ListQuery) =>
      $fetch<ApiList<Persisted<T>>>(base, { query: query as Record<string, unknown> })
        .then(r => r.data ?? []),

    /** Rows plus `meta`, for when paging moves to the server. */
    page: (query?: ListQuery) =>
      $fetch<ApiList<Persisted<T>>>(base, { query: query as Record<string, unknown> }),

    /** Throws a 404 for an unknown id; the caller decides what that means. */
    get: <R = T>(id: string) => $fetch<Persisted<R>>(`${base}/${id}`),

    create: <R = T>(draft: Draft<R>) =>
      $fetch<Persisted<R>>(base, { method: 'POST', body: body(draft) }),

    update: <R = T>(id: string, patch: Partial<R>) =>
      $fetch<Persisted<R>>(`${base}/${id}`, { method: 'PUT', body: body(patch) }),

    remove: async (id: string): Promise<void> => {
      await $fetch(`${base}/${id}`, { method: 'DELETE' })
    }
  }
}
