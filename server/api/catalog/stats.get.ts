import type { CatalogStats } from '#shared/types'
import { vertexCatalogStatsQuerySchema } from '#shared/schemas'

/** The dashboard's counters. `platformId` narrows them to one platform. */
export default defineEventHandler(async (event) => {
  const query = await getValidatedQuery(event, vertexCatalogStatsQuerySchema.parse)
  return vertex(event).one<CatalogStats>('/admin/catalog/stats', { query })
})
