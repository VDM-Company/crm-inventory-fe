import { describe, expect, it } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { defineComponent } from 'vue'

async function withSetup<T>(fn: () => T) {
  let result!: T
  await mountSuspended(defineComponent({
    setup() {
      result = fn()
      return () => null
    }
  }))
  return result
}

// Every fixture below is deliberately loose — fields missing, nulls where the
// type says otherwise. Well-formed seed rows would pass with or without the
// normalizers, so they would not prove the normalizers run.

registerEndpoint('/api/categories', {
  method: 'GET',
  handler: () => ({
    data: [
      { id: 'c1', name: 'Bare' },
      { id: 'c2', name: 'Explicitly off', parentId: 'c1', enabled: false }
    ],
    meta: null
  })
})

registerEndpoint('/api/platforms', {
  method: 'GET',
  handler: () => ({
    data: [{ id: 'p1', name: 'SIM Point', code: 'sim_point', url: 'vdm.com/sp', secretToken: 'leak-me' }],
    meta: null
  })
})

registerEndpoint('/api/attributes', {
  method: 'GET',
  handler: () => ({ data: [{ id: 'a1', name: 'Data' }], meta: null })
})

registerEndpoint('/api/fees', {
  method: 'GET',
  handler: () => ({ data: [{ id: 'f1', name: 'Tax' }], meta: { page: 1, perPage: 10, total: 1, lastPage: 1 } })
})

describe('useApiCategories', () => {
  it('fills the hierarchy defaults a bare row leaves out', async () => {
    const api = await withSetup(() => useApiCategories())
    const [bare] = await api.list()

    // a root category must say `null`, not undefined — the tree helpers compare against it
    expect(bare).toEqual({ id: 'c1', name: 'Bare', parentId: null, enabled: true })
  })

  it('does not mistake an explicit false for a missing flag', async () => {
    const api = await withSetup(() => useApiCategories())
    const rows = await api.list()

    expect(rows[1]).toEqual({ id: 'c2', name: 'Explicitly off', parentId: 'c1', enabled: false })
  })
})

describe('useApiPlatforms', () => {
  it('keeps only the fields the screens use', async () => {
    const api = await withSetup(() => useApiPlatforms())
    const [row] = await api.list()

    expect(row).toEqual({ id: 'p1', name: 'SIM Point', code: 'sim_point', url: 'vdm.com/sp' })
    expect(row).not.toHaveProperty('secretToken')
  })
})

describe('useApiAttributes', () => {
  it('gives a row with no values an empty array rather than undefined', async () => {
    const api = await withSetup(() => useApiAttributes())
    const [row] = await api.list()

    expect(row!.values).toEqual([])
  })
})

describe('useApiFees', () => {
  it('defaults the loose fields', async () => {
    const api = await withSetup(() => useApiFees())
    const tax = (await api.list()).find(f => f.id === 'f1')

    expect(tax).toMatchObject({ description: '', system: false })
  })

  it('puts Base Price back when the API does not send it', async () => {
    const api = await withSetup(() => useApiFees())
    const fees = await api.list()

    // structural, not data: every product's pricing carries it
    expect(fees[0]).toEqual({
      id: 'fee_base', name: 'Base Price', description: 'Core product price', system: true
    })
  })

  it('leaves page() alone, so the rows still match the meta counts', async () => {
    const api = await withSetup(() => useApiFees())
    const res = await api.page()

    expect(res.data.map(f => f.id)).toEqual(['f1'])
    expect(res.meta).toEqual({ page: 1, perPage: 10, total: 1, lastPage: 1 })
  })
})
