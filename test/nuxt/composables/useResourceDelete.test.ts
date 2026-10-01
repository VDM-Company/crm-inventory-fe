import { describe, expect, it } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { defineComponent, ref } from 'vue'

interface Row { id: string, name: string, system?: boolean }

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

let lastDeleted = ''
registerEndpoint('/api/widgets/w1', { method: 'DELETE', handler: () => {
  lastDeleted = 'w1'
  return null
} })
registerEndpoint('/api/widgets/boom', { method: 'DELETE', handler: () => {
  throw createError({ statusCode: 500, data: { message: 'upstream exploded' } })
} })

function setup(overrides: Partial<Parameters<typeof useResourceDelete<Row>>[0]> = {}, usage = 0) {
  const removed = ref<Row | null>(null)
  const notices: string[] = []
  return {
    removed,
    notices,
    make: () => useResourceDelete<Row>({
      resource: 'widgets',
      noun: 'widget',
      usageCount: () => usage,
      blockedMessage: u => `This widget is used by ${u} product${u === 1 ? '' : 's'}.`,
      onDeleted: (t) => {
        removed.value = t
      },
      notify: m => notices.push(m),
      ...overrides
    })
  }
}

describe('useResourceDelete', () => {
  it('is idle until a target is set', async () => {
    const { make } = setup()
    const del = await withSetup(make)

    expect(del.target.value).toBeNull()
    expect(del.title.value).toBe('')
    expect(del.message.value).toBe('')
    expect(del.blocked.value).toBe(false)
  })

  it('offers an undoable delete when nothing references the record', async () => {
    const { make } = setup({}, 0)
    const del = await withSetup(make)
    del.target.value = { id: 'w1', name: 'Widget One' }

    expect(del.blocked.value).toBe(false)
    expect(del.title.value).toBe('Delete Widget One?')
    expect(del.message.value).toBe('This action cannot be undone.')
    expect(del.icon.value).toBe('trash-2')
    expect(del.cancelLabel.value).toBe('Cancel')
  })

  it('refuses and explains when the record is still referenced', async () => {
    const { make } = setup({}, 2)
    const del = await withSetup(make)
    del.target.value = { id: 'w1', name: 'Widget One' }

    expect(del.blocked.value).toBe(true)
    expect(del.title.value).toBe('Cannot delete widget')
    expect(del.message.value).toBe('This widget is used by 2 products.')
    expect(del.icon.value).toBe('shield-alert')
    expect(del.cancelLabel.value).toBe('Close')
  })

  it('deletes, prunes the list and reports it', async () => {
    const { make, removed, notices } = setup({}, 0)
    const del = await withSetup(make)
    del.target.value = { id: 'w1', name: 'Widget One' }

    await del.confirm()

    expect(lastDeleted).toBe('w1')
    expect(removed.value).toEqual({ id: 'w1', name: 'Widget One' })
    expect(notices).toEqual(['Widget deleted'])
    expect(del.target.value).toBeNull()
  })

  it('does not call the API when blocked', async () => {
    const { make, removed, notices } = setup({}, 3)
    const del = await withSetup(make)
    del.target.value = { id: 'w1', name: 'Widget One' }

    await del.confirm()

    expect(removed.value).toBeNull()
    expect(notices).toEqual([])
    // the modal stays open so the explanation is still on screen
    expect(del.target.value).not.toBeNull()
  })

  it('does not call the API for a locked record', async () => {
    const { make, removed } = setup({ isLocked: t => !!t.system }, 0)
    const del = await withSetup(make)
    del.target.value = { id: 'w1', name: 'Base Price', system: true }

    await del.confirm()
    expect(removed.value).toBeNull()
  })

  it('surfaces a failed delete and leaves the list alone', async () => {
    const { make, removed, notices } = setup({}, 0)
    const del = await withSetup(make)
    del.target.value = { id: 'boom', name: 'Explodes' }

    await del.confirm()

    expect(removed.value).toBeNull()
    expect(notices[0]).toContain('upstream exploded')
    expect(del.target.value).toBeNull()
  })

  it('cancel clears the target without touching the API', async () => {
    const { make, removed } = setup({}, 0)
    const del = await withSetup(make)
    del.target.value = { id: 'w1', name: 'Widget One' }

    del.cancel()
    expect(del.target.value).toBeNull()
    expect(removed.value).toBeNull()
  })
})
