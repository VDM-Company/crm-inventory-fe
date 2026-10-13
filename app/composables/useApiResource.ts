import type { ApiList, Draft, ListQuery, Persisted } from '#shared/types'

/**
 * A typed client for one `server/api` resource.
 *
 * Replaces passing the resource name as a string to generic helpers: the name
 * is written once per resource, and the record type travels with it, so a
 * category create aimed at the products endpoint stops being something
 * TypeScript will happily accept.
 *
 * Reads and writes only — loading and error state belong to the caller, and
 * the pure helpers over an already-loaded list stay in `app/utils/*`.
 *
 * Bind it to a resource in its own `useApiX.ts` file (see `useApiProducts.ts`)
 * rather than calling it inline, so each resource has one place to hang the
 * endpoints that are not plain CRUD.
 *
 * The second type parameter on `get` and `update` lets a caller work
 * with a shape of its own instead of `T`. It governs the body as well as the
 * return, so a screen with its own view model sends and receives that model
 * instead of casting. It is deliberately unconstrained, and so is an unchecked
 * assertion — `get<Whatever>(id)` compiles. `<R extends T>` would be safer but
 * does not compile today; the resource bindings that rely on this say why.
 *
 * `normalize` runs over every row `list` and `page` return. The records these
 * screens read were loose long before there was an API — a missing `enabled`
 * means true, a missing `values` means `[]` — and the bindings keep applying
 * those defaults rather than spreading the guards back across the screens.
 * It deliberately does not run on `get`, whose `R` is unconstrained and so
 * need not be a `T` at all.
 */
export function useApiResource<T>(resource: string, normalize?: (row: Persisted<T>) => Persisted<T>) {
  const base = `/api/${resource}`
  const body = (v: unknown) => v as Record<string, unknown>
  const rows = (data?: Persisted<T>[]) => normalize ? (data ?? []).map(normalize) : (data ?? [])

  return {
    /** The rows only. Use `page()` when the pagination metadata matters. */
    list: (query?: ListQuery) =>
      $fetch<ApiList<Persisted<T>>>(base, { query: query as Record<string, unknown> })
        .then(r => rows(r.data)),

    /** Rows plus `meta`, for when paging moves to the server. */
    page: (query?: ListQuery) =>
      $fetch<ApiList<Persisted<T>>>(base, { query: query as Record<string, unknown> })
        .then(r => ({ ...r, data: rows(r.data) })),

    /** Throws a 404 for an unknown id; the caller decides what that means. */
    get: <R = T>(id: string) => $fetch<Persisted<R>>(`${base}/${id}`),

    /**
     * Not generic, unlike `get` / `update`: TypeScript infers a type parameter
     * from the argument rather than falling back to its default, so a `<R = T>`
     * here would quietly type the result as whatever shape the literal body
     * had, not as the record. Nothing needs the escape hatch on create.
     */
    create: (draft: Draft<T>) =>
      $fetch<Persisted<T>>(base, { method: 'POST', body: body(draft) }),

    /**
     * `NoInfer` on the patch is load-bearing: without it TypeScript infers `R`
     * from the object literal instead of falling back to `T`, so
     * `update(id, { name })` would type the result as `Persisted<{ name }>`.
     * With it, `R` is `T` unless a caller names a type itself.
     */
    update: <R = T>(id: string, patch: Partial<NoInfer<R>>) =>
      $fetch<Persisted<R>>(`${base}/${id}`, { method: 'PUT', body: body(patch) }),

    remove: async (id: string): Promise<void> => {
      await $fetch(`${base}/${id}`, { method: 'DELETE' })
    }
  }
}
