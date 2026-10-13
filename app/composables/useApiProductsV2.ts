import type {
  VertexList,
  VertexProduct,
  VertexProductDraft,
  VertexProductPatch,
  VertexProductQuery,
  VertexProductRow
} from '#shared/types'

/**
 * The products resource on the Vertex Commerce API.
 *
 * Named `V2` only while `useApiProducts` still serves the screens from the
 * older seam; it takes that name once they move.
 *
 * **There is no `list()` here, only `page()`.** Every other resource in this
 * folder is master data a screen renders in full, so its binding walks the
 * cursors server-side. Products are not: the list is unbounded, and asking
 * for all of it would be a request that grows with the catalogue. The screen
 * carries `meta.nextCursor` instead.
 *
 * Two shapes, deliberately:
 *
 * - `page()` answers `VertexProductRow` — names and prices already resolved
 *   for the requested platform, with `*Source` fields saying where each came
 *   from.
 * - `get()` answers `VertexProduct` — the Default values, with `name` and
 *   `description` as locale maps, the attribute values, media and children.
 *
 * Those two are different types on purpose. See the ASSUMPTION note on
 * `VertexProductRow`; whether the split is intended has not been confirmed.
 *
 * What is NOT here, each being its own endpoint group worth its own slice:
 * pricing and price plans, variant preview/generate/simulate, bundle options
 * and bundle price, and per-platform content.
 */
export function useApiProductsV2() {
  const base = '/api/products-v2'
  const body = (v: unknown) => v as Record<string, unknown>

  return {
    /** One page plus its cursors. There is no whole-list call by design. */
    page: (query?: VertexProductQuery) =>
      $fetch<VertexList<VertexProductRow>>(base, { query: query as Record<string, unknown> }),

    /** The Default values of one product. */
    get: (id: string) => $fetch<VertexProduct>(`${base}/${id}`),

    /** Creates product data only; prices come from the price-plan endpoints. */
    create: (draft: VertexProductDraft) =>
      $fetch<VertexProduct>(base, { method: 'POST', body: body(draft) }),

    /**
     * Neither `type` nor `status` can be changed here — the API moves a type
     * only through variant generation and a status only through `setStatus`.
     */
    update: (id: string, patch: VertexProductPatch, lockVersion: number) =>
      $fetch<VertexProduct>(`${base}/${id}`, { method: 'PATCH', body: body({ ...patch, lockVersion }) }),

    /** Soft delete. 409 when subscriptions are active, or for a variant. */
    remove: async (id: string): Promise<void> => {
      await $fetch(`${base}/${id}`, { method: 'DELETE' })
    },

    /**
     * The only way a status moves. Activating checks the product is complete,
     * so this is where `base_price_required`, `no_active_variant` and
     * `bundle_incomplete` surface.
     */
    setStatus: (id: string, status: 'draft' | 'active' | 'inactive') =>
      $fetch<VertexProduct>(`${base}/${id}/status`, { method: 'POST', body: body({ status }) }),

    /** Back as Draft if it never left Draft, else Inactive. */
    restore: (id: string) => $fetch<VertexProduct>(`${base}/${id}/restore`, { method: 'POST' }),

    /** Copies everything into a new Draft and returns it. */
    duplicate: (id: string, options?: { name?: Record<string, string>, skuPrefix?: string }) =>
      $fetch<VertexProduct>(`${base}/${id}/duplicate`, { method: 'POST', body: body(options || {}) })
  }
}

/**
 * Whether this field refuses to change, because the product has left Draft.
 *
 * Reads the server's `lockedFields` rather than reproducing the rule, so a
 * form can disable the input instead of waiting for 422 `field_locked`.
 *
 * Takes the camelCase name the app uses. The array itself holds the API's own
 * spelling — `is_subscription`, `requires_shipping` — because those are string
 * VALUES, which the case mapper leaves alone; it renames keys. Comparing the
 * two spellings directly would quietly never match.
 */
export function isLockedField(product: VertexProduct, field: string): boolean {
  const asSent = field.replace(/[A-Z]/g, c => '_' + c.toLowerCase())
  return (product.lockedFields || []).some(f => f === field || f === asSent)
}
