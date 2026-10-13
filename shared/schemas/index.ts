/**
 * Request schemas for `server/api`, in `shared/` so the forms can reuse the
 * same rules later instead of restating them (the pages currently declare
 * their own page-local zod schemas).
 *
 * Deliberately permissive: the real constraints belong to Laravel, and these
 * only guard the placeholder against obviously malformed bodies. Tighten them
 * to match once the upstream contract is known.
 *
 * Every object is `.loose()` on purpose. zod strips unknown keys by default,
 * which would silently drop any field the real API accepts but this guesswork
 * does not list — a failure that is invisible until the upstream rejects the
 * request. Validate what we know; forward the rest untouched.
 */
import * as z from 'zod'

const id = z.string().trim().min(1)
const nullableId = z.string().trim().min(1).nullable()

// A base carries NO defaults, so `.partial()` gives a true partial update.
// Defaults belong on create only: applied to an update they would overwrite
// stored values with the default whenever a field is simply absent.
const categoryBase = z.object({
  id: id.optional(),
  name: z.string({ error: 'Category name is required.' }).trim().min(1, 'Category name is required.'),
  parentId: nullableId.optional(),
  enabled: z.boolean().optional()
}).loose()
export const categoryCreateSchema = categoryBase.extend({
  parentId: nullableId.optional().default(null),
  enabled: z.boolean().optional().default(true)
})
export const categoryUpdateSchema = categoryBase.partial()

const platformBase = z.object({
  id: id.optional(),
  name: z.string({ error: 'Name is required' }).trim().min(1, 'Name is required'),
  code: z.string({ error: 'Code is required' }).trim().min(1, 'Code is required'),
  url: z.string({ error: 'URL / Path is required' }).trim().min(1, 'URL / Path is required')
}).loose()
export const platformCreateSchema = platformBase
export const platformUpdateSchema = platformBase.partial()

const attributeBase = z.object({
  id: id.optional(),
  name: z.string({ error: 'Attribute name is required.' }).trim().min(1, 'Attribute name is required.'),
  type: z.string().trim().optional(),
  values: z.array(z.string()).optional()
}).loose()
export const attributeCreateSchema = attributeBase.extend({
  values: z.array(z.string()).optional().default([])
})
export const attributeUpdateSchema = attributeBase.partial()

const feeBase = z.object({
  id: id.optional(),
  name: z.string({ error: 'Component name is required.' }).trim().min(1, 'Component name is required.'),
  icon: z.string().trim().optional(),
  description: z.string().optional(),
  system: z.boolean().optional()
}).loose()
export const feeCreateSchema = feeBase.extend({
  description: z.string().optional().default(''),
  system: z.boolean().optional().default(false)
})
export const feeUpdateSchema = feeBase.partial()

const productBase = z.object({
  id: id.optional(),
  name: z.string({ error: 'Product name is required' }).trim().min(1, 'Product name is required'),
  sku: z.string({ error: 'Enter a SKU' }).trim().min(1, 'Enter a SKU'),
  productType: z.enum(['single', 'variant', 'bundle']).optional(),
  status: z.enum(['Active', 'Inactive']).optional(),
  categoryId: z.string().optional(),
  category: z.string().optional(),
  platformIds: z.array(z.string()).optional()
}).loose()
export const productCreateSchema = productBase.extend({
  productType: z.enum(['single', 'variant', 'bundle']).optional().default('single'),
  status: z.enum(['Active', 'Inactive']).optional().default('Active'),
  platformIds: z.array(z.string()).optional().default([])
})
export const productUpdateSchema = productBase.partial()

/** Per-platform configuration values: a flat bag of strings and booleans. */
export const configValuesSchema = z.record(z.string(), z.union([z.string(), z.boolean()]))

/** Category membership + per-scope storefront ordering. */
export const categoryProductsSchema = z.object({
  members: z.array(z.string()).default([]),
  scopes: z.record(z.string(), z.object({
    positions: z.record(z.string(), z.number()).default({}),
    override: z.boolean().optional()
  })).default({})
})

export const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  perPage: z.coerce.number().int().positive().max(200).optional(),
  q: z.string().optional(),
  sort: z.string().optional(),
  dir: z.enum(['asc', 'desc']).optional()
})

// ── Vertex Commerce API ─────────────────────────────────────────────────────
// Unlike the schemas above, these are NOT guesswork: every rule comes from the
// collection in `docs/api/vertex-commerce.postman_collection.json`. They are
// still `.loose()`, so a field the API gained since that export is forwarded
// rather than silently dropped.

/** Text keyed by locale. At least one locale, each a non-empty string. */
const localizedText = z.record(z.string(), z.string().trim().min(1))
  .refine(v => Object.keys(v).length > 0, 'Give the text in at least one language.')

export const feeItemKindSchema = z.enum(['base', 'tax', 'shipping', 'other'])

export const feeItemCreateSchema = z.object({
  // the API answers 422 `regex` / `code_taken`; match it here so an obvious
  // mistake fails before the round trip
  code: z.string()
    .trim()
    .regex(/^[a-z0-9_]{2,50}$/, 'Use 2–50 lowercase letters, digits or underscores.'),
  name: localizedText,
  kind: feeItemKindSchema,
  description: localizedText.nullish(),
  icon: z.string().trim().nullish()
}).loose()

/**
 * `lockVersion` is required, not optional: the API rejects a versioned update
 * without it, and a schema that let it through would turn a typo into a
 * runtime 409 instead of a 422 here. `code` and `kind` are absent because the
 * API does not accept changes to them.
 */
export const feeItemUpdateSchema = z.object({
  lockVersion: z.number({ error: 'lockVersion is required on an update.' }).int().min(0),
  name: localizedText.optional(),
  description: localizedText.nullish(),
  icon: z.string().trim().nullish()
}).loose()

export const feeItemQuerySchema = z.object({
  kind: feeItemKindSchema.optional(),
  /** Follow every cursor and return the whole list — master data only. */
  all: z.stringbool().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  // NOT z.coerce.boolean(): that reads the string 'false' as true, so
  // `?includeTotal=false` would ask upstream for the count it calls costly.
  includeTotal: z.stringbool().optional()
}).loose()

const localeCode = z.string().trim().regex(/^[a-z]{2}(_[A-Za-z]{2,4})?$/, 'Use a locale code like `en` or `pt_BR`.')

const vertexPlatformSettingsSchema = z.object({
  store: z.object({
    name: z.string().trim().optional(),
    phone: z.string().trim().optional(),
    address: z.string().trim().optional()
  }).loose().optional(),
  mail: z.object({
    senderName: z.string().trim().optional(),
    senderEmail: z.email('Enter a valid email address.').optional()
  }).loose().optional(),
  contact: z.object({
    enabled: z.boolean().optional(),
    recipientEmail: z.email('Enter a valid email address.').optional()
  }).loose().optional()
}).loose()

export const vertexPlatformCreateSchema = z.object({
  code: z.string().trim().min(2, 'Give the platform a code.'),
  name: z.string().trim().min(1, 'Give the platform a name.'),
  domain: z.string().trim().min(1, 'Give the platform a domain.'),
  defaultLocale: localeCode,
  locales: z.array(localeCode).min(1, 'List at least one locale.'),
  // the API accepts settings on create; omitted, Contact Us starts disabled
  settings: vertexPlatformSettingsSchema.optional()
}).loose()

/** `code` is absent: the API does not accept changes to it. */
export const vertexPlatformUpdateSchema = z.object({
  lockVersion: z.number({ error: 'lockVersion is required on an update.' }).int().min(0),
  name: z.string().trim().min(1).optional(),
  domain: z.string().trim().min(1).optional(),
  defaultLocale: localeCode.optional(),
  locales: z.array(localeCode).min(1).optional()
}).loose()

/**
 * PUT /settings is a FULL REPLACE — the API clears anything omitted — so this
 * does not mark the groups optional the way a patch would.
 */
export const vertexPlatformSettingsUpdateSchema = vertexPlatformSettingsSchema.extend({
  lockVersion: z.number({ error: 'lockVersion is required on an update.' }).int().min(0)
})

export const vertexPlatformQuerySchema = z.object({
  status: z.enum(['active', 'inactive']).optional(),
  q: z.string().trim().optional(),
  all: z.stringbool().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  includeTotal: z.stringbool().optional()
}).loose()

export const attributeInputTypeSchema = z.enum(['dropdown', 'swatch', 'radio', 'text'])

const attributeOptionBody = z.object({
  label: localizedText,
  swatchType: z.string().trim().optional(),
  swatchValue: z.string().trim().optional()
}).loose()

export const vertexAttributeCreateSchema = z.object({
  code: z.string().trim().regex(/^[a-z0-9_]{2,50}$/, 'Use 2–50 lowercase letters, digits or underscores.'),
  label: localizedText,
  inputType: attributeInputTypeSchema,
  isFilterable: z.boolean().optional(),
  // the API accepts the first options inline and assigns their ids
  options: z.array(attributeOptionBody).optional()
}).loose()

/**
 * `options` is rejected rather than ignored: after creation the API manages
 * them through their own endpoints, and silently dropping them here would
 * look like a save that worked.
 */
export const vertexAttributeUpdateSchema = z.object({
  lockVersion: z.number({ error: 'lockVersion is required on an update.' }).int().min(0),
  label: localizedText.optional(),
  inputType: attributeInputTypeSchema.optional(),
  isFilterable: z.boolean().optional(),
  options: z.never({ error: 'Change options through the option endpoints, not with the attribute.' }).optional()
}).loose()

export const vertexAttributeOptionCreateSchema = attributeOptionBody
export const vertexAttributeOptionUpdateSchema = attributeOptionBody.partial()

/** Full order: every option id, in the order they should sit. */
export const vertexAttributeOptionOrderSchema = z.object({
  optionIds: z.array(z.string().trim().min(1)).min(1, 'List the options in the order they should sit.')
}).loose()

export const vertexAttributeQuerySchema = z.object({
  q: z.string().trim().optional(),
  inputType: z.string().trim().optional(),
  variantAxis: z.stringbool().optional(),
  isFilterable: z.stringbool().optional(),
  all: z.stringbool().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  includeTotal: z.stringbool().optional()
}).loose()

const categoryBody = z.object({
  name: localizedText,
  parentId: z.string().trim().min(1).nullish(),
  isEnabled: z.boolean().optional(),
  includeInMenu: z.boolean().optional(),
  // the API rejects an unknown sort with 422 `in`, but the collection names
  // only `position`, so this stays open rather than guessing the rest
  productSort: z.string().trim().optional()
}).loose()

export const vertexCategoryCreateSchema = categoryBody

export const vertexCategoryUpdateSchema = categoryBody.partial().extend({
  lockVersion: z.number({ error: 'lockVersion is required on an update.' }).int().min(0)
})

/** Only `platformId` — this list takes no cursor and returns the whole tree. */
export const vertexCategoryQuerySchema = z.object({
  platformId: z.string().trim().min(1).optional()
}).loose()

const overridableCategoryField = z.enum(['name', 'isEnabled', 'includeInMenu', 'productSort'])

/**
 * A platform's override of one category.
 *
 * The two cross-field rules are the API's own: at least one field or a reset
 * entry (422 `required_without_all`), and no field both sent and reset
 * (422 `override_and_reset`). Checking them here turns a round trip into an
 * immediate, better-worded failure.
 */
export const vertexCategoryPlatformContentSchema = z.object({
  lockVersion: z.number({ error: 'lockVersion is required on an update.' }).int().min(0),
  name: localizedText.optional(),
  isEnabled: z.boolean().optional(),
  includeInMenu: z.boolean().optional(),
  productSort: z.string().trim().optional(),
  reset: z.array(overridableCategoryField).optional()
}).loose().superRefine((val, ctx) => {
  const sent = overridableCategoryField.options.filter(f => val[f] !== undefined)
  const reset = val.reset || []

  if (!sent.length && !reset.length) {
    ctx.addIssue({ code: 'custom', path: ['reset'], message: 'Send a field to override, or one to reset.' })
  }
  for (const f of reset) {
    if (sent.includes(f)) {
      ctx.addIssue({ code: 'custom', path: ['reset'], message: `\`${f}\` cannot be both overridden and reset.` })
    }
  }
})

export const vertexCategoryProductsQuerySchema = z.object({
  platformId: z.string().trim().min(1).optional(),
  q: z.string().trim().optional(),
  all: z.stringbool().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  includeTotal: z.stringbool().optional()
}).loose()

const productIds = z.array(z.string().trim().min(1)).min(1, 'Choose at least one product.')

export const vertexCategoryProductsAddSchema = z.object({ productIds }).loose()

export const vertexCategoryProductsRemoveSchema = z.object({
  productIds,
  platformId: z.string().trim().min(1).optional()
}).loose()

/** `productIds` must be exactly the current members — 422 `members_mismatch`. */
export const vertexCategoryProductsOrderSchema = z.object({
  productIds,
  platformId: z.string().trim().min(1).optional()
}).loose()

export const vertexProductTypeSchema = z.enum(['simple', 'configurable', 'bundle'])

const productAttributeValue = z.object({
  attributeId: z.string().trim().min(1),
  optionIds: z.array(z.string().trim().min(1)).optional(),
  valueText: localizedText.optional()
}).loose().refine(
  v => (v.optionIds?.length ?? 0) > 0 || v.valueText !== undefined,
  'Give the attribute option ids or a text value.'
)

const productMedia = z.object({
  uploadId: z.string().trim().min(1),
  role: z.string().trim().optional(),
  alt: localizedText.optional()
}).loose()

const productBody = z.object({
  name: localizedText,
  sku: z.string().trim().min(1).optional(),
  description: localizedText.nullish(),
  notes: z.string().nullish(),
  requiresShipping: z.boolean().optional(),
  isSubscription: z.boolean().optional(),
  isGift: z.boolean().optional(),
  categoryIds: z.array(z.string().trim().min(1)).optional(),
  platformIds: z.array(z.string().trim().min(1)).optional(),
  attributes: z.array(productAttributeValue).optional(),
  media: z.array(productMedia).optional()
}).loose()

/** `status` may only ever be `draft` on create; anything else is 422 `in`. */
export const vertexProductCreateSchema = productBody.extend({
  type: vertexProductTypeSchema.optional(),
  status: z.literal('draft', { error: 'A product can only be created as a draft.' }).optional()
})

/**
 * `type` and `status` are rejected rather than ignored: the API changes a
 * type only through `variants/generate` and a status only through
 * `POST :id/status`, so accepting either here would look like a save that
 * worked.
 */
export const vertexProductUpdateSchema = productBody.partial().extend({
  lockVersion: z.number({ error: 'lockVersion is required on an update.' }).int().min(0),
  type: z.never({ error: 'A product type changes through variant generation, not here.' }).optional(),
  status: z.never({ error: 'Status changes through POST /status, not here.' }).optional()
})

export const vertexProductStatusSchema = z.object({
  status: z.enum(['draft', 'active', 'inactive'], { error: 'Choose draft, active or inactive.' })
}).loose()

export const vertexProductDuplicateSchema = z.object({
  name: localizedText.optional(),
  skuPrefix: z.string().trim().min(1).optional()
}).loose()

export const vertexProductQuerySchema = z.object({
  q: z.string().trim().optional(),
  hierarchy: z.enum(['top_level', 'children', 'all']).optional(),
  parentId: z.string().trim().min(1).optional(),
  sellable: z.stringbool().optional(),
  // comma lists upstream, so they stay strings rather than arrays
  type: z.string().trim().optional(),
  status: z.string().trim().optional(),
  stockStatus: z.string().trim().optional(),
  categoryId: z.string().trim().optional(),
  includeDescendants: z.stringbool().optional(),
  platformId: z.string().trim().optional(),
  platformIds: z.string().trim().optional(),
  excludeProductId: z.string().trim().min(1).optional(),
  containsProductId: z.string().trim().min(1).optional(),
  isGift: z.stringbool().optional(),
  sort: z.string().trim().optional(),
  all: z.stringbool().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  includeTotal: z.stringbool().optional()
}).loose()
