// Pure helpers over an already-loaded platform list. Reads and writes go
// through `useApiPlatforms()`.

// re-exported so the existing auto-imported call sites keep working
export { PLATFORM_SEED, SKSIM_ID, SIMPOINT_ID, OLDSTORE_ID } from '#shared/seeds'

/**
 * Generic over the record so it serves both seams while the screens migrate:
 * the older `Platform` and the API's `VertexPlatform` differ in their fields
 * but not in having an `id`.
 */
export function platformById<T extends { id: string }>(list: T[], id: string): T | null {
  return list.find(p => p.id === id) || null
}

/**
 * Platform code from a display name.
 *
 * UPPERCASE with no separators, which is how the API writes them — `SKSIM`,
 * `SIMPOINT`, `OLDSTORE` — not the lowercase `sim_point` the placeholder used.
 */
export function platformSlug(name: string): string {
  return (name || '').toUpperCase().replace(/[^A-Z0-9]+/g, '').slice(0, 32)
}
