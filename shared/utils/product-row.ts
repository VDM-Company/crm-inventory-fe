import type { StoredProduct, VertexProductRow, VertexProductStatus, VertexProductType } from '#shared/types'

/**
 * The API's product list row, flattened to the shape the list screens read.
 *
 * The dashboard, the platform product list and the category picker all work
 * on `StoredProduct` — `platformIds`, `categoryId`, `productType`, a
 * capitalised `status`. Converting here keeps those screens and their filters
 * as they are.
 *
 * What the API models as collections the old shape held as one value:
 * `categories[]` becomes the first category's id, name and path, because
 * these screens show a single category per row. A product in two categories
 * therefore shows only the first here; the Categories screen is where the
 * full membership lives.
 */

/** `simple | configurable | bundle` upstream; `single | variant | bundle` here. */
const TYPE: Record<VertexProductType, StoredProduct['productType']> = {
  simple: 'single',
  configurable: 'variant',
  bundle: 'bundle'
}

/** The screens compare against `Active`; the API sends `active`. */
function toStatus(s: VertexProductStatus | string): StoredProduct['status'] {
  const t = String(s)
  return (t.charAt(0).toUpperCase() + t.slice(1)) as StoredProduct['status']
}

export function toStoredProduct(r: VertexProductRow): StoredProduct {
  const category = (r.categories || [])[0]
  return {
    id: r.id,
    name: r.name,
    sku: r.sku,
    status: toStatus(r.status),
    productType: TYPE[r.type] ?? 'single',
    hasVariants: r.type === 'configurable',
    variantCount: r.variantCount ?? 0,
    platformIds: (r.platforms || []).map(p => p.id),
    platformNames: (r.platforms || []).map(p => p.name),
    categoryId: category?.id,
    category: category?.name,
    categoryPath: category?.path,
    image: r.imageUrl ?? undefined,
    isNew: r.isNew,
    // The API has no created timestamp on a list row. `updatedAt` is the
    // nearest thing, and the only screen reading this uses it to decide
    // whether a row is new — which `isNew` already answers properly.
    createdAt: r.updatedAt ? Date.parse(r.updatedAt) : undefined
  }
}

export const toStoredProducts = (rows: VertexProductRow[]) => rows.map(toStoredProduct)
