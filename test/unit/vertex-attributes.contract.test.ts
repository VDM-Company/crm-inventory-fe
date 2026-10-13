import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  vertexAttributeCreateSchema,
  vertexAttributeUpdateSchema,
  vertexAttributeOptionCreateSchema,
  vertexAttributeOptionUpdateSchema,
  vertexAttributeOptionOrderSchema,
  vertexAttributeQuerySchema
} from '../../shared/schemas'
import { fromVertex, toVertex } from '../../shared/utils/vertex-wire'
import { localized } from '../../shared/utils/localized'
import type { Attribute, AttributeOption } from '../../shared/types/vertex'

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
    if (!url.includes('/attributes')) continue
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

describe('attribute wire shape', () => {
  it('matches the collection key for key', () => {
    const row = example(endpoint('/attributes', 'GET'), 200).data[0]

    expect(Object.keys(row).sort()).toEqual([
      'can_be_variant_axis', 'code', 'id', 'input_type', 'is_filterable',
      'label', 'lock_version', 'options', 'sort_order', 'usage_count'
    ])
    expect(Object.keys(fromVertex<Attribute>(row)).sort()).toEqual([
      'canBeVariantAxis', 'code', 'id', 'inputType', 'isFilterable',
      'label', 'lockVersion', 'options', 'sortOrder', 'usageCount'
    ])
  })

  it('carries options as records with ids, not as a list of strings', () => {
    // the whole difference from the old shape: `values: string[]` is gone
    const attr = fromVertex<Attribute>(example(endpoint('/attributes', 'GET'), 200).data[0])

    expect(Array.isArray(attr.options)).toBe(true)
    expect(Object.keys(attr.options[0]!).sort()).toEqual([
      'id', 'label', 'sortOrder', 'swatchType', 'swatchUrl', 'swatchValue', 'usageCount', 'used'
    ])
    expect(typeof attr.options[0]!.id).toBe('string')
    expect(localized(attr.options[0]!.label)).toBeTruthy()
  })

  it('reports per-option usage, so deleting one does not need a product scan', () => {
    const attr = fromVertex<Attribute>(example(endpoint('/attributes', 'GET'), 200).data[0])
    const used = attr.options.find(o => o.used)

    expect(used).toBeDefined()
    expect(used!.usageCount).toBeGreaterThan(0)
  })

  it('does not version options, only the attribute', () => {
    const attr = fromVertex<Attribute>(example(endpoint('/attributes', 'GET'), 200).data[0])

    expect(typeof attr.lockVersion).toBe('number')
    for (const o of attr.options) expect(o).not.toHaveProperty('lockVersion')
  })

  it('decides canBeVariantAxis itself rather than leaving it to the client', () => {
    const attr = fromVertex<Attribute>(example(endpoint('/attributes', 'GET'), 200).data[0])
    expect(typeof attr.canBeVariantAxis).toBe('boolean')
  })
})

describe('option endpoints', () => {
  it('returns only the option it created', () => {
    const created = fromVertex<AttributeOption>(example(endpoint('/options', 'POST'), 201).data)

    expect(created.id).toBeTruthy()
    expect(localized(created.label)).toBe('Unlimited')
    expect(created).not.toHaveProperty('options')
    expect(created.usageCount).toBe(0)
  })

  it('returns only the option it changed', () => {
    const patched = fromVertex<AttributeOption>(example(endpoint('/options/:option', 'PATCH'), 200).data)
    expect(localized(patched.label)).toBe('White')
    expect(patched).not.toHaveProperty('code')
  })

  it('returns the WHOLE attribute after a reorder, not just the options', () => {
    const after = fromVertex<Attribute>(example(endpoint('/options/order', 'PUT'), 200).data)

    expect(after.code).toBe('color')
    expect(after.options.length).toBeGreaterThan(1)
  })

  it('builds the option bodies the collection sends', () => {
    const createBody = JSON.parse(endpoint('/options', 'POST').request!.body!.raw!)
    expect(toVertex(vertexAttributeOptionCreateSchema.parse({ label: { en: 'Unlimited' } }))).toEqual(createBody)

    const patchBody = JSON.parse(endpoint('/options/:option', 'PATCH').request!.body!.raw!)
    expect(toVertex(vertexAttributeOptionUpdateSchema.parse({
      label: { en: 'White' }, swatchType: 'color', swatchValue: '#F9FAFB'
    }))).toEqual(patchBody)

    const orderBody = JSON.parse(endpoint('/options/order', 'PUT').request!.body!.raw!)
    expect(toVertex(vertexAttributeOptionOrderSchema.parse({
      optionIds: ['01a116c8-5eb4-7346-9a97-faf7cd69fc17', '01a116c8-5eb4-7346-9a97-faf7cd2ceb95']
    }))).toEqual(orderBody)
  })

  it('wants at least one id in a reorder', () => {
    expect(() => vertexAttributeOptionOrderSchema.parse({ optionIds: [] })).toThrow()
  })

  it('lets an option patch carry one field on its own', () => {
    // changing only a swatch colour must not force the caller to resend the
    // label, which a non-partial schema would
    expect(() => vertexAttributeOptionUpdateSchema.parse({ swatchValue: '#000000' })).not.toThrow()
    expect(() => vertexAttributeOptionUpdateSchema.parse({})).not.toThrow()
    // but a create still needs the label it is named by
    expect(() => vertexAttributeOptionCreateSchema.parse({ swatchValue: '#000000' })).toThrow()
  })

  it('takes no lockVersion on an option write, because options are not versioned', () => {
    const patchBody = JSON.parse(endpoint('/options/:option', 'PATCH').request!.body!.raw!)
    expect(patchBody).not.toHaveProperty('lock_version')
  })
})

describe('attribute request bodies', () => {
  it('builds the create body the collection sends, inline options included', () => {
    const body = JSON.parse(endpoint('/attributes', 'POST').request!.body!.raw!)
    const draft = vertexAttributeCreateSchema.parse({
      code: 'validity',
      label: { en: 'Validity' },
      inputType: 'dropdown',
      isFilterable: true,
      options: [{ label: { en: '8 Days' } }, { label: { en: '16 Days' } }, { label: { en: '30 Days' } }]
    })

    expect(toVertex(draft)).toEqual(body)
  })

  it('builds the update body the collection sends', () => {
    const body = JSON.parse(endpoint('/attributes/:id', 'PATCH').request!.body!.raw!)
    expect(toVertex(vertexAttributeUpdateSchema.parse({ isFilterable: true, lockVersion: 2 }))).toEqual(body)
  })

  it('refuses options on an update rather than dropping them silently', () => {
    // the API manages them through their own endpoints; accepting the field
    // here would look like a save that worked
    expect(() => vertexAttributeUpdateSchema.parse({
      lockVersion: 0, options: [{ label: { en: 'x' } }]
    })).toThrow()
  })

  it('refuses an update with no lockVersion', () => {
    expect(() => vertexAttributeUpdateSchema.parse({ isFilterable: true })).toThrow()
  })

  it('rejects an input type the API does not define', () => {
    for (const good of ['dropdown', 'swatch', 'radio', 'text']) {
      expect(() => vertexAttributeCreateSchema.parse({ code: 'c1', label: { en: 'L' }, inputType: good })).not.toThrow()
    }
    expect(() => vertexAttributeCreateSchema.parse({ code: 'c1', label: { en: 'L' }, inputType: 'slider' })).toThrow()
  })

  it('reads the list filters the collection declares', () => {
    const q = vertexAttributeQuerySchema.parse({ q: 'col', variantAxis: 'true', isFilterable: 'false', limit: '25' })
    expect(q).toEqual({ q: 'col', variantAxis: true, isFilterable: false, limit: 25 })
  })
})
