/**
 * The transient confirmation message the screens show after a save or delete.
 *
 * Named `usePageToast`, not `useToast`: Nuxt UI ships its own `useToast()` for
 * the UToast overlay, and an auto-imported clash would shadow it.
 *
 * Owns the timeout, including clearing it on unmount — every screen was
 * repeating that, and it is the easy half to forget.
 */
export function usePageToast(defaultMs = 2800) {
  const message = ref<string | null>(null)
  let timer: ReturnType<typeof setTimeout> | undefined

  function show(msg: string, ms = defaultMs) {
    message.value = msg
    clearTimeout(timer)
    timer = setTimeout(() => {
      message.value = null
    }, ms)
  }

  /** Drop the current message and cancel its timer. */
  function dismiss() {
    clearTimeout(timer)
    message.value = null
  }

  onBeforeUnmount(() => clearTimeout(timer))

  return { message, show, dismiss }
}
