/**
 * The inventory domain, shared by the Nuxt app and the `server/api` layer.
 *
 * Nothing in `shared/` may import from `app/` or `server/`, or touch Vue or
 * Nuxt runtime APIs — it is compiled for both sides. Presentation-only shapes
 * (table rows, filter rules, dashboard tiles) stay in `app/types`.
 */

export interface Category {
  id: string
  name: string
  parentId: string | null
  enabled: boolean
}

/** Per-scope storefront ordering for one category. Keyed 'default' | platformId. */
export interface CatScopeEntry {
  positions: Record<string, number>
  override?: boolean
}

export interface CatEntry {
  members: string[]
  scopes: Record<string, CatScopeEntry>
}

export interface Platform {
  id: string
  name: string
  code: string
  url: string
}

/** A variant attribute master: a name plus its preset values. */
export interface AttributeDef {
  id: string
  name: string
  /** Text | Select | Radio | Numeric | Checkbox (legacy rows have none) */
  type?: string
  values: string[]
}

/** A reusable Initial-Fee line item. */
export interface Fee {
  id: string
  name: string
  /** lucide icon name chosen in the Pricing Setting modal */
  icon?: string
  description: string
  system: boolean
}

export type ConfigValue = string | boolean
/** The full set of configuration values owned by one platform. */
export type ConfigValues = Record<string, ConfigValue>

export type ProductType = 'single' | 'variant' | 'bundle'
export type ProductStatus = 'Active' | 'Inactive'

export interface ProductVariant {
  name: string
  sku: string
  price: string
  stock: string
  active: boolean
  image?: string | null
}

export interface ProductAttribute {
  name: string
  values: string[]
}

export interface PricingComponent {
  feeId: string
  published: boolean
  amount: string | number
}

export interface PricingVersion {
  version?: string
  isSubscription?: boolean
  monthly?: string | number
  initial?: number
  components?: PricingComponent[]
  active?: boolean
}

/** The row the Dashboard table reads. */
export interface ProductRow {
  id?: string
  name: string
  sku: string
  reference?: string
  category?: string
  categoryId?: string
  categoryPath?: string
  status: ProductStatus
  productType: ProductType
  hasVariants: boolean
  variantCount: number
  platformIds: string[]
  platformNames?: string[]
  image?: string
  createdAt?: number
  isNew?: boolean
}

/** The full persisted record — a superset of ProductRow. */
export interface StoredProduct extends ProductRow {
  notes?: string
  description?: string
  notForSale?: boolean
  isDraft?: boolean
  overrides?: Record<string, unknown>
  imageName?: string
  bundle?: {
    components: {
      id: string
      name: string
      products: { id: string, name: string, sku: string }[]
    }[]
  } | null
  attributes?: ProductAttribute[]
  variants?: ProductVariant[]
  pricing?: PricingVersion[]
}
