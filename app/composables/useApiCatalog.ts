import type { CatalogStats } from '#shared/types'

/**
 * Catalog-wide counters, as the dashboard reads them.
 *
 * Its own binding rather than a method on `useApiProducts()` because it is
 * not the products resource — it answers about the catalogue rather than
 * returning any part of it, and the API gives it its own path.
 */
export function useApiCatalog() {
  const http = useApiFetch()

  /** `platformId` narrows every counter to one platform. */
  const stats = (platformId?: string) =>
    http<CatalogStats>('/api/catalog/stats', { query: platformId ? { platformId } : undefined })

  return { stats }
}
