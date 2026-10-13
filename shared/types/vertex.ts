/**
 * The Vertex Commerce API contract.
 *
 * Every shape here is derived from the saved examples in
 * `docs/api/vertex-commerce.postman_collection.json` and from the conventions
 * its collection description states. Nothing has been checked against a live
 * backend, so treat a mismatch as the collection being newer, not as a bug in
 * the screens.
 *
 * Conventions this file encodes:
 * - Every success body is `{ data: … }`; lists add `meta`.
 * - Lists are cursor-paginated. `meta.total` only appears with
 *   `include_total=true`, which the API calls costly.
 * - Mutations on versioned resources carry `lock_version`; a mismatch is
 *   409 `stale_version`.
 * - Money is integer JPY. There are no minor units to divide by.
 * - Errors use one envelope, with per-field `errors` on 422.
 */

/** Text keyed by locale, e.g. `{ en: 'Base Price' }`. */
export type LocalizedText = Record<string, string>

export interface VertexEnvelope<T> {
  data: T
}

export interface VertexListMeta {
  /** Pass back as `cursor` to get the next page. Null on the last one. */
  nextCursor: string | null
  prevCursor: string | null
  /** Only present when the request asked for `include_total`. */
  total?: number
  /**
   * List-level extras the API adds per endpoint — `scope` on a category's
   * products, `facets` elsewhere. Carried through rather than typed here,
   * because each list defines its own.
   */
  [key: string]: unknown
}

export interface VertexList<T> {
  data: T[]
  meta: VertexListMeta
}

/** Cursor paging. Deliberately not page/perPage — the API has no page numbers. */
export interface CursorQuery {
  cursor?: string | null
  limit?: number
  /** Costly upstream; ask only when the UI shows a count. */
  includeTotal?: boolean
}

// ── errors ──────────────────────────────────────────────────────────────────

/**
 * One field's failures on a 422. The key is not always a field on the form —
 * the API also reports list-level keys such as `lines`.
 */
export interface VertexFieldError {
  code: string
  message: string
}

export interface VertexErrorBody {
  error: {
    code: string
    message: string
    details?: Record<string, unknown>
  }
  errors?: Record<string, VertexFieldError[]>
}

/** 409 codes this app acts on. The API defines more. */
export type VertexConflictCode
  = | 'stale_version'
    | 'in_use'
    | 'system_fee_item'

// ── fee items ───────────────────────────────────────────────────────────────

/** `base` is seeded and exists once. `tax` and `shipping` are system rows too. */
export type FeeItemKind = 'base' | 'tax' | 'shipping' | 'other'

/**
 * A reusable price line item.
 *
 * `usageCount` is how many price lines reference it, history included — the
 * server counts it, so no screen needs to load products to work it out.
 * `isSystem` rows refuse deletion with 409 `system_fee_item`.
 */
export interface FeeItem {
  id: string
  /** 2–50 of `[a-z0-9_]`, unique; immutable once created. */
  code: string
  name: LocalizedText
  description: LocalizedText | null
  icon: string | null
  kind: FeeItemKind
  isSystem: boolean
  usageCount: number
  lockVersion: number
}

/** POST body. `code` and `kind` cannot be changed afterwards. */
export interface FeeItemDraft {
  code: string
  name: LocalizedText
  kind: FeeItemKind
  description?: LocalizedText | null
  icon?: string | null
}

/** PATCH body. `lockVersion` is required by the API, so it is required here. */
export interface FeeItemPatch {
  name?: LocalizedText
  description?: LocalizedText | null
  icon?: string | null
}

export interface FeeItemQuery extends CursorQuery {
  kind?: FeeItemKind
}

// ── platforms ───────────────────────────────────────────────────────────────

/**
 * A sales channel.
 *
 * Prefixed `Vertex` only because `~/types` still exports the older `Platform`
 * that four screens use. It takes the plain name once they move.
 *
 * Note `name` is a plain string here, not a `LocalizedText` — the platform is
 * the thing that *has* locales, so its own name is not one of them. Fee items,
 * categories, attributes and products do localize theirs.
 *
 * There is no DELETE. A platform is switched off with `deactivate`, which is
 * why `isActive` exists and why this resource has no `remove`.
 */
export interface VertexPlatform {
  id: string
  /** Upstream writes these uppercase (`SKSIM`), unlike fee item codes. */
  code: string
  name: string
  domain: string
  isActive: boolean
  defaultLocale: string
  locales: string[]
  lockVersion: number
  createdAt: string
}

/** One group of a platform's settings. Keys are snake_case upstream. */
export interface VertexPlatformSettings {
  store: { name?: string, phone?: string, address?: string }
  mail: { senderName?: string, senderEmail?: string }
  contact: { enabled?: boolean, recipientEmail?: string }
  lockVersion: number
}

/**
 * POST body. `settings` may ride along; without it the API starts Contact Us
 * disabled, and reports setting errors under `settings.<group>.<key>`.
 */
export interface VertexPlatformDraft {
  code: string
  name: string
  domain: string
  defaultLocale: string
  locales: string[]
  settings?: Omit<VertexPlatformSettings, 'lockVersion'>
}

/** PATCH body. `code` is not changeable. */
export interface VertexPlatformPatch {
  name?: string
  domain?: string
  defaultLocale?: string
  locales?: string[]
}

export interface VertexPlatformQuery extends CursorQuery {
  status?: 'active' | 'inactive'
  q?: string
}

// ── attributes ──────────────────────────────────────────────────────────────

/** Only `dropdown` and `swatch` can be a variant axis; the server decides. */
export type AttributeInputType = 'dropdown' | 'swatch' | 'radio' | 'text'

/**
 * One value of an attribute.
 *
 * This is the piece with no equivalent in the old shape, where an attribute
 * carried `values: string[]`. Here every value is a record with its own id,
 * its own order and its own usage count — which is why writing them is four
 * endpoints rather than one array, and why a product references
 * `option_ids` rather than strings.
 *
 * There is no `lockVersion`: the API versions the attribute, not the option.
 */
export interface AttributeOption {
  id: string
  label: LocalizedText
  swatchType: string | null
  swatchValue: string | null
  swatchUrl: string | null
  sortOrder: number
  /** Whether any product or variant has ever used it. */
  used: boolean
  /** How many products use it. Deleting a used option is 409 `in_use`. */
  usageCount: number
}

export interface Attribute {
  id: string
  code: string
  label: LocalizedText
  inputType: AttributeInputType
  isFilterable: boolean
  /** Server-derived from `inputType`; not something a client sets. */
  canBeVariantAxis: boolean
  options: AttributeOption[]
  sortOrder: number
  usageCount: number
  lockVersion: number
}

/** POST body. Options may ride along, label-only; the API assigns their ids. */
export interface AttributeDraft {
  code: string
  label: LocalizedText
  inputType: AttributeInputType
  isFilterable?: boolean
  options?: { label: LocalizedText, swatchType?: string, swatchValue?: string }[]
}

/**
 * PATCH body.
 *
 * `options` is absent on purpose: after creation the API manages them through
 * their own endpoints, so changing the set is `addOption` / `updateOption` /
 * `removeOption` / `reorderOptions`, not a field here.
 */
export interface AttributePatch {
  label?: LocalizedText
  inputType?: AttributeInputType
  isFilterable?: boolean
}

export interface AttributeOptionDraft {
  label: LocalizedText
  swatchType?: string
  swatchValue?: string
}

export type AttributeOptionPatch = Partial<AttributeOptionDraft>

export interface AttributeQuery extends CursorQuery {
  q?: string
  /** Comma list; an unknown value is 422 `in`. */
  inputType?: string
  /** True narrows to the types that can be a variant axis. */
  variantAxis?: boolean
  isFilterable?: boolean
}

// ── categories ──────────────────────────────────────────────────────────────

/**
 * How a category orders its products — `position` and `-price` both appear in
 * the collection, so a leading `-` reverses. The API rejects an unknown value
 * with 422 `in`, but it does not list them, so this stays a string rather
 * than an enum invented from two examples.
 *
 * Note the value is the API's own vocabulary, field names included: it is
 * passed through untouched, because the case mapper renames keys and not
 * values. Same for a product list's `sort` (`-updated_at`).
 */
export type CategoryProductSort = string

/** One field of a category as a platform sees it, and where that value came from. */
export interface PlatformOverride<T> {
  value: T
  source: 'default' | 'platform'
}

/**
 * A category's per-platform view, present only when the request passed
 * `platformId`. Each overridable field reports its value and whether that
 * value is the platform's own or inherited from Default.
 */
export interface CategoryPlatformView {
  name: PlatformOverride<LocalizedText>
  isEnabled: PlatformOverride<boolean>
  includeInMenu: PlatformOverride<boolean>
  productSort: PlatformOverride<CategoryProductSort>
  sortOrder: PlatformOverride<number>
  /** Switched off because an ancestor is, rather than on its own account. */
  disabledByAncestor: boolean
  productsCustomOrder: boolean
  /** Versions the override, separately from the category's own. */
  lockVersion: number
}

/**
 * A node of the category tree.
 *
 * Prefixed `Vertex` only because `~/types` still exports the older `Category`
 * that the screens use. It takes the plain name once they move.
 *
 * The API returns the whole tree nested in one response — `GET
 * /admin/categories` takes no cursor and sends no `meta`. Categories go at
 * most three levels deep; a move that would exceed that is 422
 * `category_too_deep`, and moving a category under its own descendant is 422
 * `category_cycle`.
 *
 * `productCount` counts direct assignments only, not those of sub-categories.
 */
export interface VertexCategory {
  id: string
  parentId: string | null
  name: LocalizedText
  /** Ancestors joined for display, e.g. `SIM Cards / Tourist SIM`. */
  path: string
  isEnabled: boolean
  includeInMenu: boolean
  productSort: CategoryProductSort
  sortOrder: number
  productCount: number
  lockVersion: number
  /** Null unless the request passed `platformId`. */
  platform: CategoryPlatformView | null
  children: VertexCategory[]
}

export interface VertexCategoryDraft {
  name: LocalizedText
  parentId?: string | null
  isEnabled?: boolean
  includeInMenu?: boolean
  productSort?: CategoryProductSort
}

export interface VertexCategoryPatch {
  name?: LocalizedText
  /** Null moves it to the top level, which the API always allows. */
  parentId?: string | null
  isEnabled?: boolean
  includeInMenu?: boolean
  productSort?: CategoryProductSort
}

/**
 * A platform's override of one category.
 *
 * Send at least one field or a `reset` entry, else 422 `required_without_all`.
 * A field both sent and reset is 422 `override_and_reset`. `lockVersion` here
 * is the override's, from `platform.lockVersion`, not the category's.
 */
export interface VertexCategoryPlatformContentPatch {
  name?: LocalizedText
  isEnabled?: boolean
  includeInMenu?: boolean
  productSort?: CategoryProductSort
  /** Field names that should follow Default again. */
  reset?: ('name' | 'isEnabled' | 'includeInMenu' | 'productSort')[]
}

/**
 * A product as the category's product list shows it.
 *
 * `name` is a plain string here, already resolved — and with `platformId` it
 * is the name that platform shows, which `nameSource` explains.
 */
export interface VertexCategoryProduct {
  productId: string
  name: string
  nameSource: string | null
  sku: string
  type: string
  status: string
  /** Integer JPY. */
  priceFrom: number | null
  monthlyFrom: number | null
  priceDiffersOnPlatforms: number
  position: number
}

export interface VertexCategoryProductsQuery extends CursorQuery {
  platformId?: string
  q?: string
  /** Follow every cursor and return the whole list. */
  all?: boolean
}

// ── products ────────────────────────────────────────────────────────────────

/**
 * `simple` is a standalone product, `configurable` a parent with variants,
 * `bundle` a product made of other products.
 *
 * ASSUMPTION, to confirm with the backend author: `GET /admin/catalog/stats`
 * buckets products as `single | variant | bundle` instead. Two of those three
 * words differ from every product endpoint, which uses the enum below. This
 * takes the product endpoints as canonical, since they are what this resource
 * reads and writes, and leaves the stats wording alone until it is confirmed.
 */
export type VertexProductType = 'simple' | 'configurable' | 'bundle'

/**
 * The list filter documents `draft|active|inactive|trashed`, and the saved
 * examples also contain `scheduled`. Both are included rather than picking
 * one, since rejecting a status the API returns would be worse than accepting
 * one it never sends.
 */
export type VertexProductStatus = 'draft' | 'active' | 'inactive' | 'trashed' | 'scheduled'

/** The collection only ever shows `in_stock`, so this stays open. */
export type ProductStockStatus = string

/** A category as a product reports it: resolved name, no tree. */
export interface ProductCategoryRef {
  id: string
  name: string
  path: string
}

/** A platform as a product reports it. */
export interface ProductPlatformRef {
  id: string
  code: string
  name: string
  isActive?: boolean
}

export interface ProductPricingSummary {
  hasDefaultPrice: boolean | null
  /** Integer JPY. */
  defaultInitialTotal: number | null
  defaultMonthly: number | null
  /** How many platforms price it differently from Default. */
  differsOnPlatforms: number
}

/**
 * One attribute value on a product.
 *
 * `value` is option ids for a choice attribute and `LocalizedText` for a free
 * text one; `display` is what to render either way, so a screen does not have
 * to resolve ids itself.
 */
export interface ProductAttributeValue {
  attributeId: string
  code: string
  label: string
  inputType: string
  value: string[] | LocalizedText
  display: string
  /** Where the value came from — `product` is the only one the examples show. */
  source: string
}

export interface ProductMedia {
  id: string
  role: 'base' | 'gallery' | string
  url: string
  alt: LocalizedText | null
  sortOrder: number
  sizes: Record<string, string>
}

/**
 * A product as the LIST returns it.
 *
 * Deliberately a different type from `VertexProduct`: the two endpoints answer
 * with genuinely different shapes, and `name` is the clearest case — a plain
 * resolved string here, a `LocalizedText` on the detail.
 *
 * ASSUMPTION, to confirm: that this is intended rather than an oversight. The
 * `*Source` fields suggest it is — the list reports values already resolved
 * for a platform, and says where each came from — but the collection does not
 * state it.
 */
export interface VertexProductRow {
  id: string
  type: VertexProductType
  status: VertexProductStatus
  name: string
  nameSource: string | null
  sku: string
  parent: { id: string, name: string, sku: string } | null
  axisValues: unknown[]
  variantCount: number | null
  platforms: ProductPlatformRef[]
  categories: ProductCategoryRef[]
  categoriesSource: string | null
  stockStatus: ProductStockStatus
  stockStatusComputed: boolean
  pricingSummary: ProductPricingSummary
  /** Integer JPY. */
  priceFrom: number | null
  monthlyFrom: number | null
  priceSource: string | null
  priceDiffersOnPlatforms: number
  isNew: boolean
  imageUrl: string | null
  imagesSource: string | null
  deletedAt: string | null
  lockVersion: number
  updatedAt: string
}

/**
 * A product as the DETAIL returns it — the Default values, with per-platform
 * content fetched separately through `platform-content`.
 *
 * `lockedFields` are the fields the API refuses to change once the product
 * has left Draft (422 `field_locked`). `status` is not patched here either;
 * it moves through `POST :id/status`.
 */
export interface VertexProduct {
  id: string
  type: VertexProductType
  status: VertexProductStatus
  sku: string
  parentId: string | null
  parent: { id: string, name: string, sku: string } | null
  name: LocalizedText
  nameEdited: boolean
  description: LocalizedText | null
  notes: string | null
  isSubscription: boolean
  isGift: boolean
  requiresShipping: boolean
  lockedFields: string[]
  stockStatus: ProductStockStatus
  stockStatusComputed: boolean
  everOrdered: boolean
  categories: ProductCategoryRef[]
  platforms: ProductPlatformRef[]
  /** The variants of a configurable; null for anything else. */
  children: VertexProduct[] | null
  axisValues: unknown[]
  variantAxes: unknown[]
  attributes: ProductAttributeValue[]
  bundleOptions: unknown[]
  pricingSummary: ProductPricingSummary
  media: ProductMedia[]
  publishedAt: string | null
  deletedAt: string | null
  createdAt: string
  updatedAt: string
  lockVersion: number
}

/**
 * POST body.
 *
 * Creates product data only — prices are set afterwards through the
 * price-plan endpoints. A Draft needs no more than a name; without a `sku`
 * the API generates one. `status` may only ever be `draft` here.
 */
export interface VertexProductDraft {
  type?: VertexProductType
  name: LocalizedText
  sku?: string
  description?: LocalizedText | null
  notes?: string | null
  requiresShipping?: boolean
  isSubscription?: boolean
  isGift?: boolean
  categoryIds?: string[]
  platformIds?: string[]
  attributes?: { attributeId: string, optionIds?: string[], valueText?: LocalizedText }[]
  media?: { uploadId: string, role?: string, alt?: LocalizedText }[]
  status?: 'draft'
}

/**
 * PATCH body.
 *
 * `type` and `status` are absent because the API does not change them here:
 * a type only moves simple → configurable through `variants/generate`, and
 * status moves through `POST :id/status`. Per-platform name, notes, images
 * and categories go through `platform-content`.
 */
export type VertexProductPatch = Partial<Omit<VertexProductDraft, 'type' | 'status'>>

export interface VertexProductQuery extends CursorQuery {
  q?: string
  /** `top_level` by default; `children` or `all` include variants. */
  hierarchy?: 'top_level' | 'children' | 'all'
  parentId?: string
  sellable?: boolean
  /** Comma lists. */
  type?: string
  status?: string
  stockStatus?: string
  categoryId?: string
  includeDescendants?: boolean
  platformId?: string
  platformIds?: string
  excludeProductId?: string
  containsProductId?: string
  isGift?: boolean
  /**
   * The API's own spelling, e.g. `-updated_at` — a field name carried as a
   * value, so nothing translates it. Pass what the API documents.
   */
  sort?: string
}
