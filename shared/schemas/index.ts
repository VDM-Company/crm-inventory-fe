/**
 * Request schemas for `server/api`, in `shared/` so the forms can reuse the
 * same rules later instead of restating them (the pages currently declare
 * their own page-local zod schemas).
 *
 * Every rule here comes from the collection in
 * `docs/api/vertex-commerce.postman_collection.json`. An earlier set of
 * schemas above these guessed at a contract that did not exist yet; they went
 * with the placeholder routes they guarded.
 *
 * Every object is `.loose()` on purpose. zod strips unknown keys by default,
 * which would silently drop a field the API gained since that export — a
 * failure that is invisible until the upstream rejects the request. Validate
 * what the collection documents; forward the rest untouched.
 */
import * as z from 'zod'
import { camelToSnake } from '../utils/vertex-wire'

// ── Vertex Commerce API ─────────────────────────────────────────────────────

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
}).transform(v => ({
  // `reset` holds field NAMES as string values, and the case mapper renames
  // keys, not values — so `isEnabled` would go upstream unchanged and the API
  // would not know the field. Translate them here, after the checks above:
  // run on the field instead, `superRefine` would be comparing snake_case
  // reset entries against camelCase sent ones and would quietly stop firing.
  ...v,
  ...(v.reset ? { reset: v.reset.map(camelToSnake) } : {})
}))

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

const variantAxisSchema = z.object({
  attributeId: z.string().trim().min(1),
  optionIds: z.array(z.string().trim().min(1)).min(1, 'Choose at least one option on each axis.')
}).loose()

const axesSchema = z.array(variantAxisSchema).min(1, 'A variant matrix needs at least one axis.')

const combinationsSchema = z.array(z.object({
  optionIds: z.array(z.string().trim().min(1)).min(1),
  sku: z.string().trim().min(1).optional()
}).loose())

const productBody = z.object({
  name: localizedText,
  sku: z.string().trim().min(1).optional(),
  description: localizedText.nullish(),
  notes: z.string().nullish(),
  requiresShipping: z.boolean().optional(),
  isSubscription: z.boolean().optional(),
  isGift: z.boolean().optional(),
  stockStatus: z.string().trim().min(1).optional(),
  categoryIds: z.array(z.string().trim().min(1)).optional(),
  platformIds: z.array(z.string().trim().min(1)).optional(),
  attributes: z.array(productAttributeValue).optional(),
  media: z.array(productMedia).optional()
}).loose()

/** The same block as it goes inline on create, at most 100 combinations. */
export const vertexInlineVariantsSchema = z.object({
  axes: axesSchema,
  combinations: combinationsSchema.max(100, 'At most 100 variants can be created in one call.').optional()
}).loose()

/** `status` may only ever be `draft` on create; anything else is 422 `in`. */
export const vertexProductCreateSchema = productBody.extend({
  type: vertexProductTypeSchema.optional(),
  status: z.literal('draft', { error: 'A product can only be created as a draft.' }).optional(),
  /** Configurable products may create their variants in the same call. */
  variants: vertexInlineVariantsSchema.optional()
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

// ── product pricing, variants, bundles, per-platform content ────────────────

const priceLineSchema = z.object({
  lineType: z.enum(['fee', 'monthly', 'selection']),
  feeItemId: z.string().trim().min(1).nullish(),
  bundleSelectionId: z.string().trim().min(1).nullish(),
  // integer JPY; the API has no minor unit
  amount: z.number().int(),
  amountMonthly: z.number().int().nullish(),
  isPublished: z.boolean().optional()
}).loose().refine(
  // A `monthly` line references neither: it is the product's own recurring
  // price, so it carries `amountMonthly` instead of an id.
  v => v.lineType === 'fee'
    ? !!v.feeItemId
    : v.lineType === 'monthly'
      ? typeof v.amountMonthly === 'number'
      : !!v.bundleSelectionId,
  'A fee line needs a feeItemId, a monthly line an amountMonthly, a selection line a bundleSelectionId.'
)

/**
 * `scope` is `default` or a platform id. The API requires exactly one Base
 * Price line (422 `base_price_required`); that is checked upstream because
 * only it knows which fee item is the base one.
 */
export const vertexPricePlanCreateSchema = z.object({
  scope: z.string().trim().min(1),
  /** Null or past means now; later schedules it. */
  effectiveAt: z.string().trim().nullish(),
  applyToExisting: z.boolean().optional(),
  lines: z.array(priceLineSchema).min(1, 'A plan needs at least one line.')
}).loose()

export const vertexPricePlanQuerySchema = z.object({
  scope: z.string().trim().min(1).optional()
}).loose()

export const vertexVariantAxesSchema = z.object({ axes: axesSchema }).loose()

/**
 * `generate` may also name which combinations to create and their SKUs;
 * leaving them out generates the whole matrix. The key is `combinations`
 * because the API names its errors `combinations.{i}.sku`.
 */
export const vertexVariantGenerateSchema = z.object({
  axes: axesSchema,
  combinations: combinationsSchema.optional()
}).loose()

/** The Create page's dry run: the product does not exist yet, so it sends its own sku and name. */
export const vertexVariantSimulateSchema = z.object({
  sku: z.string().trim().min(1),
  name: localizedText,
  axes: axesSchema
}).loose()

const bundleSelectionSchema = z.object({
  id: z.string().trim().min(1).optional(),
  productId: z.string().trim().min(1),
  isDefault: z.boolean().optional(),
  maxQty: z.number().int().min(1).optional(),
  isHidden: z.boolean().optional()
}).loose()

export const vertexBundleOptionsSchema = z.object({
  options: z.array(z.object({
    id: z.string().trim().min(1).optional(),
    title: localizedText,
    inputType: z.string().trim().min(1),
    isRequired: z.boolean().optional(),
    selections: z.array(bundleSelectionSchema).min(1, 'Every option needs at least one selection.')
  }).loose()).min(1, 'A bundle needs at least one option.'),
  lockVersion: z.number().int().min(0).optional()
}).loose()

export const vertexBundlePriceSchema = z.object({
  platformId: z.string().trim().min(1).optional(),
  choices: z.array(z.object({
    optionId: z.string().trim().min(1),
    selectionId: z.string().trim().min(1),
    qty: z.number().int().min(1).optional()
  }).loose()).min(1, 'Choose at least one selection.')
}).loose()

const overridableContentField = z.enum(['name', 'notes', 'media', 'categoryIds'])

/**
 * Same two cross-field rules as the category override: at least one field or
 * a reset entry, and nothing both sent and reset. `reset` carries field NAMES
 * as values, so they are translated to the API's spelling after the checks —
 * running that on the field would make the second rule stop firing for
 * `categoryIds`.
 */
export const vertexProductPlatformContentSchema = z.object({
  lockVersion: z.number({ error: 'lockVersion is required on an update.' }).int().min(0),
  name: localizedText.optional(),
  notes: z.string().nullish(),
  media: z.array(z.object({
    id: z.string().trim().min(1).optional(),
    uploadId: z.string().trim().min(1).optional(),
    role: z.string().trim().optional(),
    alt: localizedText.optional()
  }).loose()).optional(),
  categoryIds: z.array(z.string().trim().min(1)).optional(),
  reset: z.array(overridableContentField).optional()
}).loose().superRefine((val, ctx) => {
  const sent = overridableContentField.options.filter(f => val[f] !== undefined)
  const reset = val.reset || []

  if (!sent.length && !reset.length) {
    ctx.addIssue({ code: 'custom', path: ['reset'], message: 'Send a field to override, or one to reset.' })
  }
  for (const f of reset) {
    if (sent.includes(f)) {
      ctx.addIssue({ code: 'custom', path: ['reset'], message: `\`${f}\` cannot be both overridden and reset.` })
    }
  }
}).transform(v => ({
  ...v,
  ...(v.reset ? { reset: v.reset.map(camelToSnake) } : {})
}))
