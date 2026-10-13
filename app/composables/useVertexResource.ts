import type { CursorQuery, VertexList } from '#shared/types'

/**
 * A typed client for one resource on the Vertex Commerce API.
 *
 * Separate from `useApiResource`, which speaks the older guessed contract —
 * PUT, page numbers, no `lock_version` — and still carries four resources.
 * The two will not be merged; the old one goes when the last resource has
 * moved off it.
 *
 * What this one does differently, and why none of it is hidden:
 *
 * - **`update` takes `lockVersion` as its own required argument.** The API
 *   refuses a versioned update without it and answers 409 `stale_version`
 *   when it is behind, so a caller that forgets should fail to compile.
 * - **`list` returns every row**, with the server walking the cursors. That is
 *   right for master data a screen renders in full and wrong for anything
 *   unbounded, which must use `page` and carry the cursor itself.
 * - **`remove` is opt-in.** Not every resource has a DELETE — platforms are
 *   deactivated instead — so asking for one it does not have is a type error
 *   rather than a 404 at runtime.
 *
 * @param resource the path segment under `/api`, e.g. `'fee-items'`
 */
export function useVertexResource<T, Draft, Patch>(resource: string) {
  const base = `/api/${resource}`
  const body = (v: unknown) => v as Record<string, unknown>

  return {
    /** Every row; the server follows the cursors. Master data only. */
    list: (query?: CursorQuery & Record<string, unknown>) =>
      $fetch<VertexList<T>>(base, { query: { ...query, all: true } }).then(r => r.data ?? []),

    /** One page plus its cursors. */
    page: (query?: CursorQuery & Record<string, unknown>) =>
      $fetch<VertexList<T>>(base, { query: query as Record<string, unknown> }),

    /** Throws 404 for an unknown id; the caller decides what that means. */
    get: (id: string) => $fetch<T>(`${base}/${id}`),

    create: (draft: Draft) => $fetch<T>(base, { method: 'POST', body: body(draft) }),

    /** `lockVersion` is the one the record carried when it was read. */
    update: (id: string, patch: Patch, lockVersion: number) =>
      $fetch<T>(`${base}/${id}`, { method: 'PATCH', body: body({ ...patch, lockVersion }) }),

    /** Only for resources that actually have a DELETE. */
    remove: async (id: string): Promise<void> => {
      await $fetch(`${base}/${id}`, { method: 'DELETE' })
    },

    /** A POST that acts on one record and returns it — `activate`, `restore`, … */
    action: (id: string, name: string) =>
      $fetch<T>(`${base}/${id}/${name}`, { method: 'POST' })
  }
}
