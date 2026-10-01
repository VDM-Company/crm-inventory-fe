import type { StoredProduct } from '#shared/types'

/**
 * The products resource.
 *
 * `/api/products` is the resource the most screens touch, so it is bound here
 * rather than inline at each call site.
 *
 * Two screens pass their own record shape through the second type parameter:
 * `DetailProduct` in `products/detail.vue` and `ParentProduct` in
 * `products/variant-detail.vue`. Neither is a superset of `StoredProduct` —
 * they widen `id` to `string | null` and make `hasVariants` / `variantCount`
 * optional — so constraining that parameter with `<R extends T>` does not
 * compile. Until those three shapes are reconciled it is an unchecked
 * assertion, not a checked narrowing.
 *
 * Endpoints beyond CRUD belong here too, next to the binding.
 */
export const useApiProducts = () => useApiResource<StoredProduct>('products')
