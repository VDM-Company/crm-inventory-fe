import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  vertexPlatformCreateSchema,
  vertexPlatformUpdateSchema,
  vertexPlatformSettingsUpdateSchema,
  vertexPlatformQuerySchema
} from '../../shared/schemas'
import { fromVertex, toVertex } from '../../shared/utils/vertex-wire'
import type { VertexPlatform, VertexPlatformSettings } from '../../shared/types/vertex'

/** Same oracle as the fee-item contract tests: the collection's own examples. */

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
    if (!url.includes('/platforms')) continue
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

describe('platform wire shape', () => {
  it('matches the collection key for key', () => {
    const row = example(endpoint('/platforms', 'GET'), 200).data[0]

    expect(Object.keys(row).sort()).toEqual([
      'code', 'created_at', 'default_locale', 'domain', 'id', 'is_active', 'locales', 'lock_version', 'name'
    ])
    expect(Object.keys(fromVertex<VertexPlatform>(row)).sort()).toEqual([
      'code', 'createdAt', 'defaultLocale', 'domain', 'id', 'isActive', 'locales', 'lockVersion', 'name'
    ])
  })

  it('keeps `name` a plain string, unlike every other resource', () => {
    // the platform is the thing that HAS locales, so its own name is not one
    const row = fromVertex<VertexPlatform>(example(endpoint('/platforms', 'GET'), 200).data[0])

    expect(typeof row.name).toBe('string')
    expect(row.locales).toContain(row.defaultLocale)
  })

  it('has no DELETE at all — a platform is deactivated instead', () => {
    expect(() => endpoint('/platforms/:platform', 'DELETE')).toThrow()

    const off = fromVertex<VertexPlatform>(example(endpoint('/deactivate', 'POST'), 200).data)
    const on = fromVertex<VertexPlatform>(example(endpoint('/activate', 'POST'), 200).data)
    expect(off.isActive).toBe(false)
    expect(on.isActive).toBe(true)
  })

  it('bumps lockVersion when deactivating, so the next write must re-read', () => {
    const on = fromVertex<VertexPlatform>(example(endpoint('/activate', 'POST'), 200).data)
    const off = fromVertex<VertexPlatform>(example(endpoint('/deactivate', 'POST'), 200).data)

    expect(off.lockVersion).toBeGreaterThan(on.lockVersion)
  })
})

describe('platform settings', () => {
  it('maps the nested groups without touching their shape', () => {
    const s = fromVertex<VertexPlatformSettings>(example(endpoint('/settings', 'GET'), 200).data)

    expect(s.mail.senderEmail).toBe('support@sk-sim.jp')
    expect(s.contact.enabled).toBe(true)
    expect(typeof s.lockVersion).toBe('number')
  })

  it('builds the full-replace body the collection sends', () => {
    const body = JSON.parse(endpoint('/settings', 'PUT').request!.body!.raw!)
    const parsed = vertexPlatformSettingsUpdateSchema.parse({
      store: { name: 'SK SIM', phone: '+81 3-6555-0142', address: '2-11-3 Shibuya, Shibuya-ku, Tokyo 150-0002' },
      mail: { senderName: 'SK SIM Support', senderEmail: 'support@sk-sim.jp' },
      contact: { enabled: true, recipientEmail: 'cs@sk-sim.jp' },
      lockVersion: 1
    })

    expect(toVertex(parsed)).toEqual(body)
  })

  it('requires lockVersion, because a full replace on a stale read loses data', () => {
    expect(() => vertexPlatformSettingsUpdateSchema.parse({ store: { name: 'x' } })).toThrow()
  })

  it('rejects an address that is not an email', () => {
    expect(() => vertexPlatformSettingsUpdateSchema.parse({
      lockVersion: 0, contact: { recipientEmail: 'not-an-email' }
    })).toThrow()
  })
})

describe('platform request bodies', () => {
  it('builds the create body the collection sends, settings included', () => {
    const body = JSON.parse(endpoint('/platforms', 'POST').request!.body!.raw!)
    const draft = vertexPlatformCreateSchema.parse({
      code: 'SKSIM',
      name: 'SK SIM',
      domain: 'sk-sim.jp',
      defaultLocale: 'en',
      locales: ['en'],
      settings: {
        store: { name: 'SK SIM', phone: '+81 3-6555-0142' },
        mail: { senderName: 'SK SIM Support', senderEmail: 'support@sk-sim.jp' },
        contact: { enabled: true, recipientEmail: 'cs@sk-sim.jp' }
      }
    })

    expect(toVertex(draft)).toEqual(body)
  })

  it('builds the update body the collection sends', () => {
    const body = JSON.parse(endpoint('/platforms/:platform', 'PATCH').request!.body!.raw!)
    expect(toVertex(vertexPlatformUpdateSchema.parse({ name: 'SIM Point', lockVersion: 0 }))).toEqual(body)
  })

  it('refuses an update with no lockVersion', () => {
    expect(() => vertexPlatformUpdateSchema.parse({ name: 'x' })).toThrow()
  })

  it('takes a locale code, not a language name', () => {
    for (const good of ['en', 'ja', 'pt_BR', 'zh_Hans']) {
      expect(() => vertexPlatformCreateSchema.parse({
        code: 'X1', name: 'n', domain: 'd', defaultLocale: good, locales: [good]
      })).not.toThrow()
    }
    for (const bad of ['English', 'e', 'EN', '']) {
      expect(() => vertexPlatformCreateSchema.parse({
        code: 'X1', name: 'n', domain: 'd', defaultLocale: bad, locales: ['en']
      })).toThrow()
    }
  })

  it('wants at least one locale', () => {
    expect(() => vertexPlatformCreateSchema.parse({
      code: 'X1', name: 'n', domain: 'd', defaultLocale: 'en', locales: []
    })).toThrow()
  })

  it('reads the list filters the collection declares', () => {
    const q = vertexPlatformQuerySchema.parse({ status: 'active', q: 'sim', limit: '25', all: 'false' })
    expect(q).toEqual({ status: 'active', q: 'sim', limit: 25, all: false })
    expect(() => vertexPlatformQuerySchema.parse({ status: 'archived' })).toThrow()
  })
})
