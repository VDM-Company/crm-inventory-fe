import type { FeeItem, FeeItemDraft, FeeItemPatch, FeeItemQuery, VertexList } from '#shared/types'

/**
 * The fee items resource, against the Vertex Commerce API.
 *
 * Standalone rather than built on `useApiResource`, because that factory
 * speaks the older contract — PUT, page numbers, no `lock_version` — and the
 * four resources still on it would break if it changed underneath them. The
 * second resource to move here is the one that should pull a shared factory
 * back out; one example is not yet a pattern.
 *
 * What is different, and why it is not hidden:
 *
 * - `update` takes `lockVersion` as its own argument, required. The API
 *   rejects a versioned update without it and answers 409 `stale_version`
 *   when it is behind, so a caller that forgets should fail to compile rather
 *   than at runtime.
 * - `list` returns every row. Fee items are master data the Pricing screen
 *   renders in full, and the server walks the cursors. Anything unbounded
 *   must use `page` instead.
 * - There is no "Base Price" guard. The old `useApiFees` invented that row
 *   when the mock omitted it; here it is a real seeded record, and inventing
 *   one would put a fabricated id into real price lines. Identify it by
 *   `kind === 'base'`. Whether a row is locked is `isSystem`, which the server
 *   decides — `kind` cannot stand in for it, because the API accepts creating
 *   a non-system item of kind `tax` or `shipping`.
 */
export function useApiFeeItems() {
  const base = '/api/fee-items'
  const body = (v: unknown) => v as Record<string, unknown>

  return {
    /** Every fee item, cursors followed server-side. */
    list: (query?: FeeItemQuery) =>
      $fetch<VertexList<FeeItem>>(base, { query: { ...query, all: true } })
        .then(r => r.data ?? []),

    /** One page plus its cursors, for a list that is not master data. */
    page: (query?: FeeItemQuery) =>
      $fetch<VertexList<FeeItem>>(base, { query: query as Record<string, unknown> }),

    /** Throws 404 for an unknown id; the caller decides what that means. */
    get: (id: string) => $fetch<FeeItem>(`${base}/${id}`),

    create: (draft: FeeItemDraft) =>
      $fetch<FeeItem>(base, { method: 'POST', body: body(draft) }),

    /** `lockVersion` is the one the record carried when it was read. */
    update: (id: string, patch: FeeItemPatch, lockVersion: number) =>
      $fetch<FeeItem>(`${base}/${id}`, { method: 'PATCH', body: body({ ...patch, lockVersion }) }),

    remove: async (id: string): Promise<void> => {
      await $fetch(`${base}/${id}`, { method: 'DELETE' })
    }
  }
}
