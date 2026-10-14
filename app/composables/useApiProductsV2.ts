import type {
  BundleOption,
  BundleOptionsDraft,
  BundleQuote,
  PricePlan,
  PricePlanDraft,
  ProductContent,
  ProductPlatformContentPatch,
  ProductPricing,
  VariantAxis,
  VariantCombination,
  VariantGenerateResult,
  VariantPreview,
  VariantSimulation,
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
 * Beyond the resource itself it carries four endpoint groups the product
 * screens need: pricing and price plans, variants, bundles, and per-platform
 * content. They are grouped below rather than flattened, because each is a
 * different concern with its own rules.
 */
export function useApiProductsV2() {
  const base = '/api/products-v2'
  const body = (v: unknown) => v as Record<string, unknown>

  return {
    /** One page plus its cursors. There is no whole-list call by design. */
    page: (query?: VertexProductQuery) =>
      $fetch<VertexList<VertexProductRow>>(base, { query: query as Record<string, unknown> }),

    /**
     * The Default values of one product. `include: 'children'` adds a
     * configurable's variants, as list rows carrying their axis values.
     */
    get: (id: string, options?: { include?: 'children' }) =>
      $fetch<VertexProduct>(`${base}/${id}`, { query: options?.include ? { include: options.include } : undefined }),

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
      $fetch<VertexProduct>(`${base}/${id}/duplicate`, { method: 'POST', body: body(options || {}) }),

    // ── pricing ─────────────────────────────────────────────────────────────

    /**
     * How every scope prices this product. Sellable products only: a
     * configurable parent answers 422 `not_sellable`, because the prices live
     * on its variants.
     */
    pricing: (id: string) => $fetch<ProductPricing>(`${base}/${id}/pricing`),

    /** Every plan for one scope, scheduled and superseded ones included. */
    pricePlans: (id: string, scope?: string) =>
      $fetch<{ data: PricePlan[] }>(`${base}/${id}/price-plans`, { query: scope ? { scope } : undefined })
        .then(r => r.data ?? []),

    /**
     * A new plan. `effectiveAt` null or in the past takes effect now and
     * supersedes the active one; a later one is scheduled and switches over
     * exactly then. Exactly one Base Price line, or 422 `base_price_required`.
     */
    createPricePlan: (id: string, draft: PricePlanDraft) =>
      $fetch<PricePlan>(`${base}/${id}/price-plans`, { method: 'POST', body: body(draft) }),

    /** Start pricing separately on one platform, copying the Default plan. */
    overridePlatformPrice: (id: string, platformId: string) =>
      $fetch<ProductPricing>(`${base}/${id}/pricing/platforms/${platformId}/override`, { method: 'POST' }),

    /** Put a platform back on the Default price; history is kept. */
    resetPlatformPrice: (id: string, platformId: string) =>
      $fetch<ProductPricing>(`${base}/${id}/pricing/platforms/${platformId}/reset`, { method: 'POST' }),

    // ── variants ────────────────────────────────────────────────────────────

    /** What generating these axes would do, without doing it. */
    previewVariants: (id: string, axes: VariantAxis[]) =>
      $fetch<VariantPreview>(`${base}/${id}/variants/preview`, { method: 'POST', body: body({ axes }) }),

    /**
     * Creates the variants, replacing the existing set. Prices are not set
     * here — they come afterwards through `createPricePlan`.
     *
     * Leaving `combinations` out generates the whole matrix of `axes`. Naming
     * it `combinations` matters: the API reports its errors under
     * `combinations.{i}.sku`, and a body under any other key is simply
     * ignored — which the Postman mock cannot catch, because it never reads
     * request bodies at all.
     *
     * A simple product becomes configurable here; its own SKU becomes the
     * parent SKU and stops being sellable.
     *
     * A set over 100 runs as a job and answers with a `jobId` instead of the
     * products, so a caller has to check which it got back.
     */
    generateVariants: (id: string, axes: VariantAxis[], combinations?: VariantCombination[]) =>
      $fetch<VariantGenerateResult>(`${base}/${id}/variants/generate`, {
        method: 'POST',
        body: body({ axes, ...(combinations ? { combinations } : {}) })
      }),

    // ── bundles ─────────────────────────────────────────────────────────────

    bundleOptions: (id: string) =>
      $fetch<{ data: BundleOption[] }>(`${base}/${id}/bundle-options`).then(r => r.data ?? []),

    /**
     * Replaces the contents. Send a selection back WITH its id to keep the
     * in-bundle price attached to it; without one it is a new selection and
     * the price does not follow.
     */
    saveBundleOptions: (id: string, draft: BundleOptionsDraft) =>
      $fetch<{ data: BundleOption[] }>(`${base}/${id}/bundle-options`, { method: 'PUT', body: body(draft) })
        .then(r => r.data ?? []),

    /** What one set of choices costs. */
    quoteBundle: (
      id: string,
      choices: { optionId: string, selectionId: string, qty?: number }[],
      platformId?: string
    ) =>
      $fetch<BundleQuote>(`${base}/${id}/bundle-price`, {
        method: 'POST',
        body: body({ choices, ...(platformId ? { platformId } : {}) })
      }),

    // ── per-platform content ────────────────────────────────────────────────

    /** Default content plus what each platform overrides. */
    platformContent: (id: string) => $fetch<ProductContent>(`${base}/${id}/platform-content`),

    /**
     * `lockVersion` is the override's own — from the platform entry in
     * `platformContent()`, not `product.lockVersion`.
     */
    setPlatformContent: (
      id: string,
      platformId: string,
      patch: ProductPlatformContentPatch,
      lockVersion: number
    ) =>
      $fetch<ProductContent>(`${base}/${id}/platform-content/${platformId}`, {
        method: 'PATCH',
        body: body({ ...patch, lockVersion })
      })
  }
}

/**
 * The Create page's variant dry run.
 *
 * Not on the resource binding because it has no product id: the product does
 * not exist yet, so the caller supplies the SKU and name it is about to have.
 */
export const simulateVariants = (sku: string, name: Record<string, string>, axes: VariantAxis[]) =>
  $fetch<VariantSimulation>('/api/products-v2/variants/simulate', {
    method: 'POST',
    body: { sku, name, axes } as unknown as Record<string, unknown>
  })

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
