/**
 * Soft delete. 409 `has_active_subscriptions` with the count in
 * `details.activeSubscriptions`; 409 `use_regeneration` for a variant, which
 * is removed by regenerating its parent instead. An already trashed product
 * is a 404.
 */
export default defineEventHandler(event =>
  vertexRemoveHandler(event, '/admin/products', 'product'))
