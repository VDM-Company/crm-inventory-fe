import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  vertexCategoryCreateSchema,
  vertexCategoryUpdateSchema,
  vertexCategoryQuerySchema,
  vertexCategoryPlatformContentSchema,
  vertexCategoryProductsAddSchema,
  vertexCategoryProductsOrderSchema,
  vertexCategoryProductsRemoveSchema
} from '../../shared/schemas'
import { fromVertex, toVertex, toListMeta } from '../../shared/utils/vertex-wire'
import { localized } from '../../shared/utils/localized'
import type { VertexCategory, VertexCategoryProduct } from '../../shared/types/vertex'

interface PostmanResponse { code: number, name?: string, body?: string }
interface PostmanRequest { method?: string, url?: { raw?: string } | string, body?: { raw?: string } }
interface PostmanItem { name: string, item?: PostmanItem[], request?: PostmanRequest, response?: PostmanResponse[] }

const collection = JSON.parse(
  readFileSync(resolve(__dirname, '../../docs/api/vertex-commerce.postman_collection.json'), 'utf8')
) as { item: PostmanItem[] }

function* walk(items: PostmanItem[]): Generator<PostmanItem> {
  for (const it of items) {
    if (it.item) yield* walk(it.item)
    else yield it
  }
}

const rawUrl = (r?: PostmanRequest) => (typeof r?.url === 'string' ? r.url : r?.url?.raw) || ''

function endpoint(path: string, method: string): PostmanItem {
  for (const it of walk(collection.item)) {
    const url = rawUrl(it.request)
    if (!url.includes('/categories')) continue
    if (it.request?.method !== method) continue
    if (url.split('?')[0]!.endsWith(path)) return it
  }
  throw new Error(`no ${method} ${path} in the collection`)
}

const example = (item: PostmanItem, code: number, which = 0) => {
  const all = (item.response || []).filter(x => x.code === code)
  const r = all[which]
  if (!r) throw new Error(`no ${code}[${which}] example on ${item.name}`)
  return r.body ? JSON.parse(r.body) : null
}

describe('the category tree', () => {
  it('arrives nested, with no pagination at all', () => {
    const body = example(endpoint('/categories', 'GET'), 200)

    // no cursor to follow and no meta to read: the whole tree comes at once
    expect(body.meta ?? null).toBeNull()
    expect(Object.keys(body)).toEqual(['data'])

    const roots = fromVertex<VertexCategory[]>(body.data)
    expect(roots.some(r => r.children.length > 0)).toBe(true)
  })

  it('matches the collection key for key, children included', () => {
    const node = example(endpoint('/categories', 'GET'), 200).data[0]

    expect(Object.keys(node).sort()).toEqual([
      'children', 'id', 'include_in_menu', 'is_enabled', 'lock_version',
      'name', 'parent_id', 'path', 'platform', 'product_count', 'product_sort', 'sort_order'
    ])
    expect(Object.keys(fromVertex<VertexCategory>(node)).sort()).toEqual([
      'children', 'id', 'includeInMenu', 'isEnabled', 'lockVersion',
      'name', 'parentId', 'path', 'platform', 'productCount', 'productSort', 'sortOrder'
    ])
  })

  it('maps children all the way down, not just the roots', () => {
    const roots = fromVertex<VertexCategory[]>(example(endpoint('/categories', 'GET'), 200).data)
    const child = roots.flatMap(r => r.children).find(Boolean)!

    // a mapper that stopped at the top level would leave parent_id in place
    expect(child).toHaveProperty('parentId')
    expect(child).not.toHaveProperty('parent_id')
    expect(child.parentId).toBe(roots[0]!.id)
  })

  it('localizes the name but leaves `path` a plain display string', () => {
    const root = fromVertex<VertexCategory>(example(endpoint('/categories', 'GET'), 200).data[0])

    expect(localized(root.name)).toBe('SIM Cards')
    expect(typeof root.path).toBe('string')
  })

  it('reports a direct product count, not a subtree count', () => {
    const roots = fromVertex<VertexCategory[]>(example(endpoint('/categories', 'GET'), 200).data)
    const simCards = roots.find(r => localized(r.name) === 'SIM Cards')!

    // it has children that hold products, but counts only its own
    expect(simCards.productCount).toBe(0)
    expect(simCards.children.length).toBeGreaterThan(0)
  })

  it('leaves `platform` null until a platform is asked for', () => {
    const root = fromVertex<VertexCategory>(example(endpoint('/categories', 'GET'), 200).data[0])
    expect(root.platform).toBeNull()
  })
})

describe('per-platform overrides', () => {
  it('reports each field with its value and where it came from', () => {
    const cat = fromVertex<VertexCategory>(example(endpoint('/platform-content/:platform', 'PATCH'), 200).data)
    const view = cat.platform!

    expect(localized(view.name.value)).toBe('Travel SIM Cards')
    expect(view.name.source).toBe('platform')
    expect(view.isEnabled.source).toBe('default')
    expect(typeof view.disabledByAncestor).toBe('boolean')
  })

  it('versions the override separately from the category', () => {
    const cat = fromVertex<VertexCategory>(example(endpoint('/platform-content/:platform', 'PATCH'), 200).data)

    expect(typeof cat.lockVersion).toBe('number')
    expect(typeof cat.platform!.lockVersion).toBe('number')
    // the two are not the same number in this example, which is the point:
    // sending one where the other belongs is a 409 that looks like a race
    expect(cat.platform!.lockVersion).not.toBe(cat.lockVersion)
  })

  it('builds the override body the collection sends', () => {
    const body = JSON.parse(endpoint('/platform-content/:platform', 'PATCH').request!.body!.raw!)
    const parsed = vertexCategoryPlatformContentSchema.parse({ lockVersion: 1, name: { en: 'Travel SIM Cards' } })

    expect(toVertex(parsed)).toEqual(body)
  })

  it('refuses a body that neither overrides nor resets anything', () => {
    // the API answers 422 `required_without_all`; failing here is faster
    expect(() => vertexCategoryPlatformContentSchema.parse({ lockVersion: 1 })).toThrow()
  })

  it('refuses a field that is both overridden and reset', () => {
    // the API answers 422 `override_and_reset`
    expect(() => vertexCategoryPlatformContentSchema.parse({
      lockVersion: 1, name: { en: 'x' }, reset: ['name']
    })).toThrow()
  })

  it('accepts a reset on its own', () => {
    expect(() => vertexCategoryPlatformContentSchema.parse({ lockVersion: 1, reset: ['name'] })).not.toThrow()
  })

  it('rejects resetting a field the API does not let a platform override', () => {
    expect(() => vertexCategoryPlatformContentSchema.parse({ lockVersion: 1, reset: ['path'] })).toThrow()
  })
})

describe('category membership', () => {
  it('lists products with a resolved name and a position', () => {
    const body = example(endpoint('/products', 'GET'), 200)
    const rows = fromVertex<VertexCategoryProduct[]>(body.data)

    expect(Object.keys(rows[0]!).sort()).toEqual([
      'monthlyFrom', 'name', 'nameSource', 'position', 'priceDiffersOnPlatforms',
      'priceFrom', 'productId', 'sku', 'status', 'type'
    ])
    // already a string here, unlike the category's own name
    expect(typeof rows[0]!.name).toBe('string')
    expect(rows[0]!.position).toBe(1)
  })

  it('prices in whole yen, with no minor unit to divide by', () => {
    const rows = fromVertex<VertexCategoryProduct[]>(example(endpoint('/products', 'GET'), 200).data)
    const priced = rows.find(r => r.priceFrom != null)!

    expect(Number.isInteger(priced.priceFrom)).toBe(true)
  })

  it('carries the list-level `scope` through the meta', () => {
    const meta = toListMeta(example(endpoint('/products', 'GET'), 200).meta)

    expect(meta.nextCursor).toBeNull()
    expect(meta.scope).toMatchObject({ source: 'platform' })
  })

  it('answers each membership write with what it did', () => {
    expect(example(endpoint('/products', 'POST'), 200).data).toEqual({ assigned: true })
    expect(example(endpoint('/products', 'PUT'), 200).data).toEqual({ saved: true })

    const removed = fromVertex<{ removed: string[], keptOnPlatform: string[] }>(
      example(endpoint('/products', 'DELETE'), 200).data)
    expect(removed.removed).toHaveLength(1)
    expect(removed.keptOnPlatform).toEqual([])
  })

  it('builds the membership bodies the collection sends', () => {
    const add = JSON.parse(endpoint('/products', 'POST').request!.body!.raw!)
    expect(toVertex(vertexCategoryProductsAddSchema.parse({
      productIds: ['01a116c8-6391-73f0-ae63-ec1e8416ef3a', '01a116c8-65e6-737e-abb9-38371018112e']
    }))).toEqual(add)

    const del = JSON.parse(endpoint('/products', 'DELETE').request!.body!.raw!)
    expect(toVertex(vertexCategoryProductsRemoveSchema.parse({
      productIds: ['01a116c8-6958-7189-aaad-934bf5b46fb4'],
      platformId: '01a116c8-5d68-7007-a79d-4f65f606f29c'
    }))).toEqual(del)

    const order = JSON.parse(endpoint('/products', 'PUT').request!.body!.raw!)
    expect(toVertex(vertexCategoryProductsOrderSchema.parse({
      platformId: '01a116c8-5d68-7007-a79d-4f65f606f29c',
      productIds: ['01a116c8-65e6-737e-abb9-38371018112e', '01a116c8-6391-73f0-ae63-ec1e8416ef3a']
    }))).toEqual(order)
  })

  it('refuses an empty id list on every membership write', () => {
    for (const schema of [
      vertexCategoryProductsAddSchema,
      vertexCategoryProductsRemoveSchema,
      vertexCategoryProductsOrderSchema
    ]) {
      expect(() => schema.parse({ productIds: [] })).toThrow()
    }
  })
})

describe('category request bodies', () => {
  it('builds the create body the collection sends', () => {
    const body = JSON.parse(endpoint('/categories', 'POST').request!.body!.raw!)
    expect(toVertex(vertexCategoryCreateSchema.parse({
      name: { en: 'Tourist SIM' }, parentId: '01a116c8-5f59-720a-8ab7-47b2ccb23a6a'
    }))).toEqual(body)
  })

  it('builds the update body the collection sends', () => {
    const body = JSON.parse(endpoint('/categories/:id', 'PATCH').request!.body!.raw!)
    expect(toVertex(vertexCategoryUpdateSchema.parse({ isEnabled: true, lockVersion: 0 }))).toEqual(body)
  })

  it('lets parentId be null, which moves a category to the top level', () => {
    const parsed = vertexCategoryUpdateSchema.parse({ parentId: null, lockVersion: 0 })
    expect(toVertex(parsed)).toEqual({ parent_id: null, lock_version: 0 })
  })

  it('refuses an update with no lockVersion', () => {
    expect(() => vertexCategoryUpdateSchema.parse({ isEnabled: true })).toThrow()
  })

  it('takes only platformId on the tree query — there is nothing to page', () => {
    expect(vertexCategoryQuerySchema.parse({ platformId: 'p1' })).toEqual({ platformId: 'p1' })
  })
})
