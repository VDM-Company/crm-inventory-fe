import { describe, expect, it } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { defineComponent } from 'vue'
import { FEE_BASE_ID } from '../../../shared/seeds'

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

// The last binding still on the older seam: the three product forms read fees
// through it. The fixtures are deliberately loose — fields missing, nulls
// where the type says otherwise — because well-formed seed rows would pass
// whether or not the normalizer runs.

registerEndpoint('/api/fees', {
  method: 'GET',
  handler: () => ({ data: [{ id: 'f1', name: 'Tax' }], meta: { page: 1, perPage: 10, total: 1, lastPage: 1 } })
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

    // structural, not data: every product's pricing carries it. The id comes
    // from the seed rather than a literal, so it survives the seed being
    // realigned to the upstream's ids.
    expect(fees[0]).toEqual({
      id: FEE_BASE_ID, name: 'Base Price', description: 'Core product price', system: true
    })
  })

  it('leaves page() alone, so the rows still match the meta counts', async () => {
    const api = await withSetup(() => useApiFees())
    const res = await api.page()

    expect(res.data.map(f => f.id)).toEqual(['f1'])
    expect(res.meta).toEqual({ page: 1, perPage: 10, total: 1, lastPage: 1 })
  })
})
