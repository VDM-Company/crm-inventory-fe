import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { feeItemCreateSchema, feeItemUpdateSchema, feeItemQuerySchema } from '../../shared/schemas'
import { fromVertex, toVertex, toListMeta, vertexErrorData } from '../../shared/utils/vertex-wire'
import { localized, FEE_ITEM_CODE_PATTERN } from '../../shared/utils/localized'
import type { FeeItem } from '../../shared/types/vertex'

/**
 * Contract tests for fee items, run against the saved examples in the Postman
 * collection rather than against a server.
 *
 * The point is drift: when the collection is re-exported and a field is added,
 * renamed or retyped, these fail. Calling the Postman mock instead would prove
 * less — it serves these same static examples, rate-limits, and needs a
 * network — so the file on disk is the better oracle.
 *
 * These exercise the pure halves of the seam (case mapping, envelope and error
 * shaping, the request schemas). The server client itself needs Nitro's
 * auto-imports, so it is covered by the nuxt-environment tests.
 */

// ── the collection, as the oracle ───────────────────────────────────────────

interface PostmanResponse { code: number, name?: string, body?: string }
interface PostmanRequest {
  method?: string
  url?: { raw?: string } | string
  body?: { raw?: string }
}
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

/** The fee-item request whose path ends in `path` and uses `method`. */
function endpoint(path: string, method: string): PostmanItem {
  for (const it of walk(collection.item)) {
    const url = rawUrl(it.request)
    if (!url.includes('/fee-items')) continue
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

describe('fee item wire shape', () => {
  it('matches the collection key for key, so a re-export that drifts fails here', () => {
    const row = example(endpoint('/fee-items', 'GET'), 200).data[0]

    // the wire keys, exactly as the API sends them
    expect(Object.keys(row).sort()).toEqual([
      'code', 'description', 'icon', 'id', 'is_system', 'kind', 'lock_version', 'name', 'usage_count'
    ])

    // and what the app sees after the seam
    const mapped = fromVertex<FeeItem>(row)
    expect(Object.keys(mapped).sort()).toEqual([
      'code', 'description', 'icon', 'id', 'isSystem', 'kind', 'lockVersion', 'name', 'usageCount'
    ])
  })

  it('keeps locale keys out of the case mapper', () => {
    // `name: { en: … }` is data keyed by locale. A locale written `pt_br` must
    // not become `ptBr`, or it stops matching the locale the UI asks for.
    // (`pt_BR` would survive either way — the mapper only matches `_[a-z0-9]`
    // — so it is the lowercase form that actually tests the guard.)
    const mapped = fromVertex<{ name: Record<string, string> }>({
      name: { en: 'Base Price', pt_br: 'Preço base', zh_hans: '基本价格' },
      lock_version: 0
    })

    expect(Object.keys(mapped.name).sort()).toEqual(['en', 'pt_br', 'zh_hans'])
    expect(mapped).toHaveProperty('lockVersion', 0)
  })

  it('does case-map the error details bag, whose keys are field names', () => {
    // 409 `in_use` carries `details.usage_count`; `stale_version` carries
    // `details.lock_version`. Those are fields, not data keys, so the screens
    // read them camelCased like everything else.
    //
    // Mapped nested, the way the error body actually arrives — mapping the
    // bag on its own would pass whether or not `details` is exempted, and so
    // would not pin the rule.
    const mapped = fromVertex<{ error: { details: Record<string, unknown> } }>({
      error: {
        code: 'in_use',
        message: 'Still referenced.',
        details: { entity: 'FeeItem', id: 'x', lock_version: 3, usage_count: 12 }
      }
    })

    expect(Object.keys(mapped.error.details).sort()).toEqual(['entity', 'id', 'lockVersion', 'usageCount'])
  })

  it('reads every kind the collection uses', () => {
    const rows = example(endpoint('/fee-items', 'GET'), 200).data as { kind: string }[]
    const kinds = new Set(rows.map(r => r.kind))

    for (const k of kinds) expect(['base', 'tax', 'shipping', 'other']).toContain(k)
  })

  it('carries the lock_version an update has to send back', () => {
    const row = fromVertex<FeeItem>(example(endpoint('/fee-items/:id', 'GET'), 200).data)
    expect(typeof row.lockVersion).toBe('number')
  })

  it('reports usage from the server, so no screen has to count products', () => {
    const rows = fromVertex<FeeItem[]>(example(endpoint('/fee-items', 'GET'), 200).data)
    expect(rows.every(r => typeof r.usageCount === 'number')).toBe(true)
  })
})

describe('cursor pagination', () => {
  it('returns cursors, not page numbers', () => {
    const meta = example(endpoint('/fee-items', 'GET'), 200).meta

    expect(meta).toHaveProperty('next_cursor')
    expect(meta).not.toHaveProperty('current_page')
    expect(meta).not.toHaveProperty('last_page')
  })

  it('converts the API meta into the cursor meta the app carries', () => {
    const meta = example(endpoint('/fee-items', 'GET'), 200).meta
    const mapped = toListMeta(meta)

    expect(mapped.nextCursor).toBe(meta.next_cursor)
    expect(mapped.prevCursor).toBeNull()
    // `total` only exists when the request asked for it, and this one did not
    expect(mapped).not.toHaveProperty('total')
  })

  it('carries total through only when the API sent one', () => {
    expect(toListMeta({ next_cursor: null, total: 7 })).toEqual({ nextCursor: null, prevCursor: null, total: 7 })
    expect(toListMeta({})).toEqual({ nextCursor: null, prevCursor: null })
  })
})

describe('request bodies', () => {
  it('builds the create body the collection sends', () => {
    const collectionBody = JSON.parse(endpoint('/fee-items', 'POST').request!.body!.raw!)
    const draft = feeItemCreateSchema.parse({
      code: 'activation_fee',
      name: { en: 'Activation Fee' },
      kind: 'other'
    })

    expect(toVertex(draft)).toEqual(collectionBody)
  })

  it('builds the update body the collection sends, lock_version included', () => {
    const collectionBody = JSON.parse(endpoint('/fee-items/:id', 'PATCH').request!.body!.raw!)
    const patch = feeItemUpdateSchema.parse({
      description: { en: 'One-time fee to activate the line' },
      lockVersion: 0
    })

    expect(toVertex(patch)).toEqual(collectionBody)
  })

  it('refuses an update with no lockVersion rather than letting it 409 upstream', () => {
    expect(() => feeItemUpdateSchema.parse({ name: { en: 'x' } })).toThrow()
  })

  it('enforces the code rule the API states', () => {
    // "2–50 lowercase letters, digits or `_`", 422 `regex` otherwise
    for (const good of ['tax', 'activation_fee', 'a1', 'x'.repeat(50)]) {
      expect(FEE_ITEM_CODE_PATTERN.test(good)).toBe(true)
      expect(() => feeItemCreateSchema.parse({ code: good, name: { en: 'n' }, kind: 'other' })).not.toThrow()
    }
    for (const bad of ['A', 'x', 'Tax', 'with space', 'dash-ed', 'x'.repeat(51), '']) {
      expect(FEE_ITEM_CODE_PATTERN.test(bad)).toBe(false)
      expect(() => feeItemCreateSchema.parse({ code: bad, name: { en: 'n' }, kind: 'other' })).toThrow()
    }
  })

  it('rejects a kind the API does not define', () => {
    expect(() => feeItemCreateSchema.parse({ code: 'ok', name: { en: 'n' }, kind: 'discount' })).toThrow()
  })

  it('wants text in at least one language', () => {
    expect(() => feeItemCreateSchema.parse({ code: 'ok', name: {}, kind: 'other' })).toThrow()
  })

  it('forwards fields the collection gained since this schema was written', () => {
    // `.loose()`: dropping an unknown key silently would be invisible until
    // the upstream rejected the request
    const parsed = feeItemCreateSchema.parse({
      code: 'ok', name: { en: 'n' }, kind: 'other', somethingNew: 'keep me'
    })
    expect(parsed).toHaveProperty('somethingNew', 'keep me')
  })

  it('coerces the query the way a URL delivers it', () => {
    const q = feeItemQuerySchema.parse({ kind: 'tax', limit: '25', includeTotal: 'true', all: 'true' })
    expect(q).toEqual({ kind: 'tax', limit: 25, includeTotal: true, all: true })
  })

  it('reads the string \'false\' as false', () => {
    // z.coerce.boolean() reads any non-empty string as true, which would turn
    // ?includeTotal=false into a request for the count the API calls costly
    const q = feeItemQuerySchema.parse({ includeTotal: 'false', all: 'false' })
    expect(q).toEqual({ includeTotal: false, all: false })
  })
})

describe('error envelope', () => {
  it('flattens a 422 into one message per field', () => {
    const flat = vertexErrorData(example(endpoint('/fee-items', 'POST'), 422))

    expect(flat.code).toBe('validation_failed')
    expect(flat.message).toBe('The given data was invalid.')
    // the API also reports keys that are not form fields, such as `lines`
    expect(flat.fieldErrors.lines).toBe('Base Price is required.')
  })

  it('carries a 409 code and its details, which the screens act on', () => {
    // `in_use` on a fee item reports the count; `stale_version` reports the
    // version the caller should have sent
    const flat = vertexErrorData({
      error: {
        code: 'in_use',
        message: 'Still referenced by 12 price lines.',
        details: { entity: 'FeeItem', id: 'x', lock_version: 3, usage_count: 12 }
      }
    })

    expect(flat.code).toBe('in_use')
    expect(flat.details).toEqual({ entity: 'FeeItem', id: 'x', lockVersion: 3, usageCount: 12 })
  })

  it('still produces a message when the body is missing entirely', () => {
    // a network failure or a non-JSON 502 reaches here with no envelope
    const flat = vertexErrorData(undefined)

    expect(flat.code).toBe('upstream_error')
    expect(flat.message).toBeTruthy()
    expect(flat.fieldErrors).toEqual({})
  })

  it('does not read 422 messages as plain strings', () => {
    // the old Laravel guess was `errors: { field: ['message'] }`; this API
    // sends `[{ code, message }]`, and reading it the old way yields undefined
    const body = example(endpoint('/fee-items', 'POST'), 422)
    const entry = body.errors.lines[0]

    expect(typeof entry).toBe('object')
    expect(entry).toHaveProperty('code')
    expect(String(entry)).not.toBe('Base Price is required.')
  })

  it('has every status the screens must handle', () => {
    const codes = (k: string, m: string) => (endpoint(k, m).response || []).map(r => r.code)

    expect(codes('/fee-items', 'GET')).toEqual(expect.arrayContaining([200, 401, 403]))
    expect(codes('/fee-items', 'POST')).toEqual(expect.arrayContaining([201, 422]))
    expect(codes('/fee-items/:id', 'PATCH')).toEqual(expect.arrayContaining([200, 404, 409, 422]))
    expect(codes('/fee-items/:id', 'DELETE')).toEqual(expect.arrayContaining([204, 404, 409]))
  })

  it('sends no body on a 204 delete', () => {
    const del = (endpoint('/fee-items/:id', 'DELETE').response || []).find(r => r.code === 204)
    expect(del!.body || '').toBe('')
  })
})

describe('localized()', () => {
  it('prefers the asked-for locale', () => {
    expect(localized({ en: 'Tax', ja: '税' }, 'ja')).toBe('税')
  })

  it('falls back to English, then to whatever is there, then to empty', () => {
    expect(localized({ en: 'Tax' }, 'ja')).toBe('Tax')
    expect(localized({ ja: '税' }, 'de')).toBe('税')
    expect(localized(null)).toBe('')
    expect(localized({})).toBe('')
  })

  it('renders a real row from the collection', () => {
    const row = fromVertex<FeeItem>(example(endpoint('/fee-items/:id', 'GET'), 200).data)
    expect(localized(row.name)).toBe('Tax')
    expect(localized(row.description)).toBe('')
  })
})
