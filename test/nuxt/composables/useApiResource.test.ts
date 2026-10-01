import { describe, expect, it } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { defineComponent } from 'vue'
import { readBody } from 'h3'

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

const calls: { method: string, url: string, body?: unknown }[] = []

registerEndpoint('/api/products', {
  method: 'GET',
  handler: () => ({
    data: [{ id: 'p1', name: 'Tourist SIM', sku: 'SKU-1' }],
    meta: { page: 2, perPage: 1, total: 7, lastPage: 7 }
  })
})
registerEndpoint('/api/products', {
  method: 'POST',
  handler: async (event) => {
    calls.push({ method: 'POST', url: '/api/products', body: await readBody(event) })
    return { id: 'p_new', name: 'Created', sku: 'SKU-N' }
  }
})
registerEndpoint('/api/products/p1', {
  method: 'GET',
  handler: () => ({ id: 'p1', name: 'Tourist SIM', sku: 'SKU-1' })
})
registerEndpoint('/api/products/p1', {
  method: 'PUT',
  handler: async (event) => {
    calls.push({ method: 'PUT', url: '/api/products/p1', body: await readBody(event) })
    return { id: 'p1', name: 'Renamed', sku: 'SKU-1' }
  }
})
registerEndpoint('/api/products/p1', {
  method: 'DELETE',
  handler: () => {
    calls.push({ method: 'DELETE', url: '/api/products/p1' })
    return null
  }
})
registerEndpoint('/api/widgets/w1', {
  method: 'GET',
  handler: () => ({ id: 'w1', name: 'A widget' })
})
registerEndpoint('/api/products/missing', {
  method: 'GET',
  handler: () => {
    throw createError({ statusCode: 404, data: { message: 'products/missing not found' } })
  }
})

describe('useApiProducts', () => {
  it('list unwraps the envelope to just the rows', async () => {
    const api = await withSetup(() => useApiProducts())
    const rows = await api.list()

    expect(rows).toHaveLength(1)
    expect(rows[0]!.name).toBe('Tourist SIM')
  })

  it('page keeps the metadata, for when paging moves to the server', async () => {
    const api = await withSetup(() => useApiProducts())
    const res = await api.page({ page: 2, perPage: 1 })

    expect(res.meta).toEqual({ page: 2, perPage: 1, total: 7, lastPage: 7 })
    expect(res.data).toHaveLength(1)
  })

  it('get fetches one record', async () => {
    const api = await withSetup(() => useApiProducts())
    expect((await api.get('p1')).id).toBe('p1')
  })

  it('get lets a 404 through, so the caller decides what a missing id means', async () => {
    const api = await withSetup(() => useApiProducts())
    await expect(api.get('missing')).rejects.toMatchObject({ statusCode: 404 })
  })

  it('create posts the draft and returns the record the server assigned an id to', async () => {
    const api = await withSetup(() => useApiProducts())
    const created = await api.create({ name: 'Created', sku: 'SKU-N' } as never)

    expect(created.id).toBe('p_new')
    expect(calls.find(c => c.method === 'POST')?.body).toMatchObject({ name: 'Created' })
  })

  it('update sends only the patch it is given', async () => {
    const api = await withSetup(() => useApiProducts())
    const updated = await api.update('p1', { name: 'Renamed' })

    expect(updated.name).toBe('Renamed')
    expect(calls.find(c => c.method === 'PUT')?.body).toEqual({ name: 'Renamed' })
  })

  it('remove resolves without a value', async () => {
    const api = await withSetup(() => useApiProducts())
    await expect(api.remove('p1')).resolves.toBeUndefined()
    expect(calls.some(c => c.method === 'DELETE')).toBe(true)
  })

  it('builds the path from whatever resource name it is given', async () => {
    // the whole point: the resource is named once, not at every call site
    const api = await withSetup(() => useApiResource<{ name: string }>('widgets'))
    expect(await api.get('w1')).toEqual({ id: 'w1', name: 'A widget' })
  })
})
