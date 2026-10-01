import type { ApiList, Draft, ListQuery, Persisted, StoredProduct } from '#shared/types'

/**
 * A typed client for one `server/api` resource.
 *
 * Replaces passing the resource name as a string to generic helpers: the name
 * is written once here, and the record type travels with it, so
 * `apiCreate<Category>('products', …)` stops being something TypeScript will
 * happily accept.
 *
 * Reads and writes only — loading and error state belong to the caller, and
 * the pure helpers over an already-loaded list stay in `app/utils/*`.
 *
 * The second type parameter on `get` / `create` / `update` is an escape hatch
 * for the two product screens that work with their own shapes
 * (`DetailProduct`, `ParentProduct`). It governs the body as well as the
 * return, so those screens send and receive their own type instead of casting.
 *
 * It is deliberately unconstrained, and so is an unchecked assertion: those
 * two interfaces are not supersets of `StoredProduct` — they widen `id` to
 * `string | null` and make `hasVariants` / `variantCount` optional — so
 * `<R extends T>` does not compile. Reconciling the three shapes is its own
 * job; until then `get<Whatever>(id)` will type-check against any `R`.
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

export const useApiProducts = () => useApiResource<StoredProduct>('products')
