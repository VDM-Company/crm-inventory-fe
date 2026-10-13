import type { ApiMode } from '#shared/types'

/** Which backend is answering, so the mode is visible without reading logs. */
export default defineEventHandler((): { mode: ApiMode, upstream: string | null } => {
  const b = backend()
  const base = String(useRuntimeConfig().apiBaseUrl || '')
  return { mode: b.mode, upstream: base || null }
})
