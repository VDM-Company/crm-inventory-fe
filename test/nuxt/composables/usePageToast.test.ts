import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { defineComponent } from 'vue'

async function withSetup<T>(fn: () => T) {
  let result!: T
  const wrapper = await mountSuspended(defineComponent({
    setup() {
      result = fn()
      return () => null
    }
  }))
  return { result, wrapper }
}

describe('usePageToast', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('starts with no message', async () => {
    const { result } = await withSetup(() => usePageToast())
    expect(result.message.value).toBeNull()
  })

  it('shows a message and clears it after the default delay', async () => {
    const { result } = await withSetup(() => usePageToast(2800))

    result.show('Saved')
    expect(result.message.value).toBe('Saved')

    vi.advanceTimersByTime(2799)
    expect(result.message.value).toBe('Saved')

    vi.advanceTimersByTime(1)
    expect(result.message.value).toBeNull()
  })

  it('accepts a per-call duration', async () => {
    const { result } = await withSetup(() => usePageToast(3000))

    result.show('Quick', 500)
    vi.advanceTimersByTime(500)
    expect(result.message.value).toBeNull()
  })

  it('restarts the timer when a second message arrives', async () => {
    // without clearing the first timeout, the second message would vanish early
    const { result } = await withSetup(() => usePageToast(1000))

    result.show('First')
    vi.advanceTimersByTime(900)
    result.show('Second')

    vi.advanceTimersByTime(900)
    expect(result.message.value).toBe('Second')

    vi.advanceTimersByTime(100)
    expect(result.message.value).toBeNull()
  })

  it('dismisses on demand and cancels the pending timer', async () => {
    const { result } = await withSetup(() => usePageToast(1000))

    result.show('Saved')
    result.dismiss()
    expect(result.message.value).toBeNull()

    // nothing left to fire
    expect(vi.getTimerCount()).toBe(0)
  })

  it('clears its timer on unmount', async () => {
    // the half everyone forgot to write by hand
    const { result, wrapper } = await withSetup(() => usePageToast(1000))

    result.show('Saved')
    expect(vi.getTimerCount()).toBe(1)

    wrapper.unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
})
