import type { Platform } from '#shared/types'

/**
 * The platforms resource — the sales channels every product is assigned to.
 *
 * The normalizer picks the four fields the screens use, so an upstream row
 * that carries more does not leak extra keys into the pages.
 *
 * `/api/platforms/:id/config` is a singleton sub-resource and still lives in
 * `app/utils/config.ts`; this binding only covers the CRUD routes.
 */
export const useApiPlatforms = () => useApiResource<Platform>('platforms', p => ({
  id: p.id,
  name: p.name,
  code: p.code,
  url: p.url
}))
