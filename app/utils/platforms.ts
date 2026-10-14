// Pure helpers over an already-loaded platform list. Reads and writes go
// through `useApiPlatforms()`.

/**
 * Generic over the record because the callers hold different shapes — a
 * `VertexPlatform` from the API, or a row a screen has already folded — and
 * all they share is an `id`.
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
