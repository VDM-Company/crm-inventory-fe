import type {
  VertexCategory,
  VertexCategoryDraft,
  VertexCategoryPatch,
  VertexCategoryPlatformContentPatch,
  VertexCategoryProduct,
  VertexCategoryProductsQuery,
  VertexList
} from '#shared/types'

/**
 * The categories resource on the Vertex Commerce API.
 *
 * Named `V2` only while `useApiCategories` still serves the pages from the
 * older seam; it takes that name once they move.
 *
 * Three ways this differs from every other resource here:
 *
 * - **The list is a nested tree, not a page.** `GET /admin/categories` takes
 *   no cursor and returns no `meta` — the whole tree arrives at once, at most
 *   three levels deep. `page` is therefore not offered; there is nothing to
 *   page through.
 * - **Membership is its own sub-resource** with four verbs, and each answers
 *   with what it did rather than with the category.
 * - **A platform can override a category** — its name, whether it is enabled,
 *   whether it appears in the menu, how it sorts products. Those overrides
 *   carry their own `lockVersion`, separate from the category's, and each
 *   field reports whether its value is the platform's or inherited.
 */
export function useApiCategoriesV2() {
  const base = '/api/categories-v2'
  const body = (v: unknown) => v as Record<string, unknown>

  return {
    /**
     * The whole tree, nested. Pass `platformId` to see it as that platform
     * does; without it every node's `platform` is null.
     */
    tree: (platformId?: string) =>
      $fetch<VertexList<VertexCategory>>(base, { query: platformId ? { platformId } : undefined })
        .then(r => r.data ?? []),

    /** One category with its sub-categories. */
    get: (id: string, platformId?: string) =>
      $fetch<VertexCategory>(`${base}/${id}`, { query: platformId ? { platformId } : undefined }),

    create: (draft: VertexCategoryDraft) =>
      $fetch<VertexCategory>(base, { method: 'POST', body: body(draft) }),

    /** Moving is a `parentId` change; null puts it at the top level. */
    update: (id: string, patch: VertexCategoryPatch, lockVersion: number) =>
      $fetch<VertexCategory>(`${base}/${id}`, { method: 'PATCH', body: body({ ...patch, lockVersion }) }),

    remove: async (id: string): Promise<void> => {
      await $fetch(`${base}/${id}`, { method: 'DELETE' })
    },

    // ── membership ──────────────────────────────────────────────────────────

    /** The products assigned directly to this category, in display order. */
    products: (id: string, query?: VertexCategoryProductsQuery) =>
      $fetch<VertexList<VertexCategoryProduct>>(`${base}/${id}/products`, {
        query: { ...query, all: true }
      }).then(r => r.data ?? []),

    /** One page of them, for a category with many products. */
    productsPage: (id: string, query?: VertexCategoryProductsQuery) =>
      $fetch<VertexList<VertexCategoryProduct>>(`${base}/${id}/products`, {
        query: query as Record<string, unknown>
      }),

    /** Appends to the end of every order. */
    addProducts: (id: string, productIds: string[]) =>
      $fetch<{ assigned: boolean }>(`${base}/${id}/products`, { method: 'POST', body: body({ productIds }) }),

    /**
     * Answers with what it did. `keptOnPlatform` lists products still in the
     * category on that platform because they carry their own categories there.
     */
    removeProducts: (id: string, productIds: string[], platformId?: string) =>
      $fetch<{ removed: string[], keptOnPlatform: string[] }>(`${base}/${id}/products`, {
        method: 'DELETE',
        body: body({ productIds, platformId })
      }),

    /**
     * Sets the order. Send exactly the current members — a subset is 422
     * `members_mismatch` — so order the list you just read.
     */
    orderProducts: (id: string, productIds: string[], platformId?: string) =>
      $fetch<{ saved: boolean }>(`${base}/${id}/products`, {
        method: 'PUT',
        body: body({ productIds, platformId })
      }),

    // ── per-platform overrides ──────────────────────────────────────────────

    /**
     * Override this category for one platform, or list fields in `reset` to
     * let them follow Default again.
     *
     * `lockVersion` is the override's own — `category.platform.lockVersion`,
     * not `category.lockVersion`. Passing the wrong one is a 409 that reads
     * like a race but is not.
     */
    setPlatformContent: (
      id: string,
      platformId: string,
      patch: VertexCategoryPlatformContentPatch,
      lockVersion: number
    ) =>
      $fetch<VertexCategory>(`${base}/${id}/platform-content/${platformId}`, {
        method: 'PATCH',
        body: body({ ...patch, lockVersion })
      })
  }
}

/**
 * Flatten the tree depth-first, carrying each node's depth.
 *
 * The screens render a tree but reason about rows. Pure, so it can drive a
 * computed over an already-loaded tree.
 */
export function flattenCategoryTree(
  nodes: VertexCategory[],
  depth = 0
): { category: VertexCategory, depth: number }[] {
  return nodes.flatMap(category => [
    { category, depth },
    ...flattenCategoryTree(category.children || [], depth + 1)
  ])
}
