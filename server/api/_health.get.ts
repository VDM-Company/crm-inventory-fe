/** Whether the Vertex API is configured, so the mode is visible without reading logs. */
export default defineEventHandler((): { mode: 'vertex' | 'unconfigured', upstream: string | null } => {
  const base = String(useRuntimeConfig().vertexApiBase || '')
  return { mode: base ? 'vertex' : 'unconfigured', upstream: base || null }
})
