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
