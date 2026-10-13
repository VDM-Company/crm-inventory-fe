import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  vertexProductCreateSchema,
  vertexProductUpdateSchema,
  vertexProductStatusSchema,
  vertexProductDuplicateSchema,
  vertexProductQuerySchema
} from '../../shared/schemas'
import { fromVertex, toVertex } from '../../shared/utils/vertex-wire'
import { localized } from '../../shared/utils/localized'
import type { VertexProduct, VertexProductRow } from '../../shared/types/vertex'

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
    if (!url.includes('/admin/products')) continue
    if (it.request?.method !== method) continue
    if (url.split('?')[0]!.endsWith(path)) return it
  }
  throw new Error(`no ${method} ${path} in the collection`)
}

const example = (item: PostmanItem, code: number) => {
  const r = (item.response || []).find(x => x.code === code)
  if (!r) throw new Error(`no ${code} example on ${item.name}`)
  return r.body ? JSON.parse(r.body) : null
}

const listBody = () => example(endpoint('/admin/products', 'GET'), 200)
const detailBody = () => example(endpoint('/admin/products/:product', 'GET'), 200)

describe('the list and the detail are different shapes', () => {
  it('answer with different key sets', () => {
    const rowKeys = new Set(Object.keys(listBody().data[0]))
    const detailKeys = new Set(Object.keys(detailBody().data))

    // not a subset either way: each carries fields the other does not
    expect([...rowKeys].some(k => !detailKeys.has(k))).toBe(true)
    expect([...detailKeys].some(k => !rowKeys.has(k))).toBe(true)
  })

  it('give `name` as a resolved string in the list and a locale map on the detail', () => {
    // the ambiguity this slice assumes is intentional; if the backend says
    // otherwise, this test is where it surfaces
    const row = listBody().data[0]
    const detail = detailBody().data

    expect(typeof row.name).toBe('string')
    expect(typeof detail.name).toBe('object')
    expect(localized(fromVertex<VertexProduct>(detail).name)).toBe(row.name)
  })

  it('say where the list resolved each value from', () => {
    const row = fromVertex<VertexProductRow>(listBody().data[0])

    for (const k of ['nameSource', 'categoriesSource', 'priceSource', 'imagesSource'] as const) {
      expect(row).toHaveProperty(k)
    }
  })

  it('match the collection key for key, both of them', () => {
    expect(Object.keys(fromVertex<VertexProductRow>(listBody().data[0])).sort()).toEqual([
      'axisValues', 'categories', 'categoriesSource', 'deletedAt', 'id', 'imageUrl', 'imagesSource',
      'isNew', 'lockVersion', 'monthlyFrom', 'name', 'nameSource', 'parent', 'platforms',
      'priceDiffersOnPlatforms', 'priceFrom', 'priceSource', 'pricingSummary', 'sku', 'status',
      'stockStatus', 'stockStatusComputed', 'type', 'updatedAt', 'variantCount'
    ])
    expect(Object.keys(fromVertex<VertexProduct>(detailBody().data)).sort()).toEqual([
      'attributes', 'axisValues', 'bundleOptions', 'categories', 'children', 'createdAt', 'deletedAt',
      'description', 'everOrdered', 'id', 'isGift', 'isSubscription', 'lockVersion', 'lockedFields',
      'media', 'name', 'nameEdited', 'notes', 'parent', 'parentId', 'platforms', 'pricingSummary',
      'publishedAt', 'requiresShipping', 'sku', 'status', 'stockStatus', 'stockStatusComputed',
      'type', 'updatedAt', 'variantAxes'
    ])
  })
})

describe('product types and statuses', () => {
  it('uses simple | configurable | bundle on every product endpoint', () => {
    const types = new Set((listBody().data as { type: string }[]).map(r => r.type))

    for (const t of types) expect(['simple', 'configurable', 'bundle']).toContain(t)
    // the words the stats endpoint uses are NOT the ones products use
    expect(types.has('single')).toBe(false)
    expect(types.has('variant')).toBe(false)
  })

  it('still disagrees with catalog/stats, which is the open question', () => {
    const stats = (() => {
      for (const it of walk(collection.item)) {
        if (!rawUrl(it.request).includes('catalog/stats')) continue
        return example(it, 200).data
      }
      throw new Error('no catalog/stats example')
    })()

    // documents the contradiction rather than asserting either side is right
    expect(Object.keys(stats.products_by_type).sort()).toEqual(['bundle', 'single', 'variant'])
  })

  it('accepts only draft on create, because the API answers 422 `in` otherwise', () => {
    expect(() => vertexProductCreateSchema.parse({ name: { en: 'n' }, status: 'draft' })).not.toThrow()
    expect(() => vertexProductCreateSchema.parse({ name: { en: 'n' }, status: 'active' })).toThrow()
  })

  it('moves a status only through its own endpoint', () => {
    const body = JSON.parse(endpoint('/status', 'POST').request!.body!.raw!)
    expect(toVertex(vertexProductStatusSchema.parse({ status: 'active' }))).toEqual(body)

    // and not through the patch
    expect(() => vertexProductUpdateSchema.parse({ lockVersion: 1, status: 'active' })).toThrow()
  })

  it('accepts only the statuses the transition rules name', () => {
    for (const ok of ['draft', 'active', 'inactive']) {
      expect(() => vertexProductStatusSchema.parse({ status: ok })).not.toThrow()
    }
    // `trashed` is a delete and `scheduled` is not a transition a client asks
    // for, so neither belongs on this endpoint
    for (const bad of ['trashed', 'scheduled', 'published', '']) {
      expect(() => vertexProductStatusSchema.parse({ status: bad })).toThrow()
    }
  })

  it('refuses a type change on the patch, which only variant generation does', () => {
    expect(() => vertexProductUpdateSchema.parse({ lockVersion: 1, type: 'configurable' })).toThrow()
  })
})

describe('detail payload', () => {
  it('resolves each attribute to something renderable', () => {
    const p = fromVertex<VertexProduct>(detailBody().data)

    for (const a of p.attributes) {
      expect(a.display).toBeTruthy()
      // a choice attribute carries option ids, a text one a locale map
      expect(Array.isArray(a.value) || typeof a.value === 'object').toBe(true)
    }
    const choice = p.attributes.find(a => Array.isArray(a.value))!
    expect(typeof (choice.value as string[])[0]).toBe('string')
  })

  it('names the fields that refuse to change once out of Draft', () => {
    const p = fromVertex<VertexProduct>(detailBody().data)

    expect(p.lockedFields).toContain('sku')
    expect(p.status).not.toBe('draft')
  })

  it('prices in whole yen', () => {
    const p = fromVertex<VertexProduct>(detailBody().data)
    expect(Number.isInteger(p.pricingSummary.defaultInitialTotal)).toBe(true)
  })

  it('keeps media alt text localized while the url stays flat', () => {
    const p = fromVertex<VertexProduct>(detailBody().data)
    const base = p.media.find(m => m.role === 'base')!

    expect(typeof base.url).toBe('string')
    expect(localized(base.alt)).toBeTruthy()
  })
})

describe('request bodies', () => {
  it('builds the create body the collection sends', () => {
    const body = JSON.parse(endpoint('/admin/products', 'POST').request!.body!.raw!)
    const draft = vertexProductCreateSchema.parse({
      type: 'simple',
      name: { en: 'Tourist SIM 15GB' },
      sku: 'TSIM-15GB',
      description: { en: body.description.en },
      notes: 'Supplier: docomo MVNO, cartons of 50',
      requiresShipping: true,
      categoryIds: body.category_ids,
      platformIds: body.platform_ids,
      attributes: [
        { attributeId: '01a116c8-5e8e-70d0-83b6-4b5eff865d8e', optionIds: ['01a116c8-5e8f-7185-973c-5944c103517f'] },
        { attributeId: '01a116c8-5e73-73d7-a7a7-36866640010c', optionIds: ['01a116c8-5e75-736e-9d62-35de415780e6'] },
        { attributeId: '01a116c8-5f01-7336-bb2a-1aa0e6277eda', valueText: { en: 'docomo 4G/5G' } }
      ],
      media: body.media.map((m: { upload_id: string, role: string, alt: Record<string, string> }) => ({
        uploadId: m.upload_id, role: m.role, alt: m.alt
      }))
    })

    expect(toVertex(draft)).toEqual(body)
  })

  it('builds the update body the collection sends', () => {
    const body = JSON.parse(endpoint('/admin/products/:product', 'PATCH').request!.body!.raw!)
    expect(toVertex(vertexProductUpdateSchema.parse({
      platformIds: body.platform_ids, lockVersion: 1
    }))).toEqual(body)
  })

  it('builds the duplicate body the collection sends', () => {
    const body = JSON.parse(endpoint('/duplicate', 'POST').request!.body!.raw!)
    expect(toVertex(vertexProductDuplicateSchema.parse({
      name: { en: 'Pocket WiFi Router X2' }, skuPrefix: 'WIFI-X2'
    }))).toEqual(body)
  })

  it('wants an attribute to carry either option ids or text, not neither', () => {
    expect(() => vertexProductCreateSchema.parse({
      name: { en: 'n' }, attributes: [{ attributeId: 'a1' }]
    })).toThrow()
    expect(() => vertexProductCreateSchema.parse({
      name: { en: 'n' }, attributes: [{ attributeId: 'a1', optionIds: ['o1'] }]
    })).not.toThrow()
    expect(() => vertexProductCreateSchema.parse({
      name: { en: 'n' }, attributes: [{ attributeId: 'a1', valueText: { en: 'x' } }]
    })).not.toThrow()
  })

  it('needs no more than a name to create a draft', () => {
    expect(() => vertexProductCreateSchema.parse({ name: { en: 'Just a name' } })).not.toThrow()
  })

  it('refuses an update with no lockVersion', () => {
    expect(() => vertexProductUpdateSchema.parse({ notes: 'x' })).toThrow()
  })
})

describe('list filters', () => {
  it('reads the filters as a URL delivers them', () => {
    const q = vertexProductQuerySchema.parse({
      q: 'sim', hierarchy: 'children', parentId: 'p1', sellable: 'true',
      type: 'simple,bundle', status: 'draft,active', includeDescendants: 'false',
      isGift: 'false', limit: '25'
    })

    expect(q).toMatchObject({
      sellable: true, includeDescendants: false, isGift: false, limit: 25,
      type: 'simple,bundle', status: 'draft,active', hierarchy: 'children'
    })
  })

  it('keeps comma lists as strings, since that is what the API takes', () => {
    const q = vertexProductQuerySchema.parse({ platformIds: 'a,b,c', categoryId: 'x,y' })
    expect(q.platformIds).toBe('a,b,c')
    expect(q.categoryId).toBe('x,y')
  })

  it('rejects a hierarchy the API does not define', () => {
    expect(() => vertexProductQuerySchema.parse({ hierarchy: 'everything' })).toThrow()
  })
})
