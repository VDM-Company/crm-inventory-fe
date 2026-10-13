/**
 * The delete-with-protection flow the master screens share: a confirm modal
 * that refuses when the record is still referenced, and the modal copy that
 * goes with it.
 *
 * `usageCount` is what makes a delete blocked — it is a getter rather than a
 * number so it re-reads whenever the product list it counts against changes.
 */
export interface ResourceDeleteOptions<T> {
  /** API resource segment, e.g. `'fees'`. */
  resource: string
  /** Singular noun for the modal copy, e.g. `'component'`. */
  noun: string
  /** How many records still reference the target; 0 means safe to delete. */
  usageCount: (target: T) => number
  /** Sentence shown when blocked. Receives the count. */
  blockedMessage: (count: number) => string
  /** Called after a successful delete so the page can drop the row. */
  onDeleted: (target: T) => void
  /** Transient message, usually `usePageToast().show`. */
  notify: (message: string) => void
  /** Refuse regardless of usage — the locked system rows. */
  isLocked?: (target: T) => boolean
}

export function useResourceDelete<T extends { id: string, name: string }>(
  options: ResourceDeleteOptions<T>
) {
  const target = ref<T | null>(null) as Ref<T | null>

  const usage = computed(() => target.value ? options.usageCount(target.value) : 0)
  const blocked = computed(() => usage.value > 0)

  const icon = computed(() => blocked.value ? 'shield-alert' : 'trash-2')
  const title = computed(() => {
    const t = target.value
    if (!t) return ''
    return blocked.value ? `Cannot delete ${options.noun}` : `Delete ${t.name}?`
  })
  const message = computed(() => {
    if (!target.value) return ''
    return blocked.value ? options.blockedMessage(usage.value) : 'This action cannot be undone.'
  })
  const cancelLabel = computed(() => blocked.value ? 'Close' : 'Cancel')

  async function confirm() {
    const t = target.value
    if (!t || blocked.value) return
    if (options.isLocked?.(t)) return
    try {
      await apiRemove(options.resource, t.id)
    } catch (err) {
      target.value = null
      options.notify(apiErrorMessage(err, `Could not delete the ${options.noun}.`))
      return
    }
    options.onDeleted(t)
    target.value = null
    options.notify(`${options.noun.charAt(0).toUpperCase()}${options.noun.slice(1)} deleted`)
  }

  function cancel() {
    target.value = null
  }

  return { target, usage, blocked, icon, title, message, cancelLabel, confirm, cancel }
}
