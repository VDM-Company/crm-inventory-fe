import type { Category } from '#shared/types'

/**
 * The categories resource — a hierarchy, so `parentId` is null at the root
 * rather than absent, and a row with no `enabled` flag counts as enabled.
 *
 * `/api/categories/:id/products` (membership + per-scope positions) is a
 * sub-resource with its own shape; it still lives in `app/utils/categories.ts`
 * because this binding only covers the CRUD routes.
 */
export const useApiCategories = () => useApiResource<Category>('categories', c => ({
  id: c.id,
  name: c.name,
  parentId: c.parentId || null,
  enabled: c.enabled !== false
}))
