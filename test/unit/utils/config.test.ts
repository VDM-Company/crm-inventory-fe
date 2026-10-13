import { describe, expect, it } from 'vitest'
import { platformConfigSeed } from '../../../app/utils/config'
import { GENERIC_CONFIG_SEED, PLATFORM_CONFIG_SEED } from '../../../shared/seeds'

describe('platformConfigSeed', () => {
  it('returns the platform own defaults when it has them', () => {
    const id = Object.keys(PLATFORM_CONFIG_SEED)[0]!
    expect(platformConfigSeed(id)).toEqual(PLATFORM_CONFIG_SEED[id])
  })

  it('falls back to the generic set for a platform with no seed, such as a new one', () => {
    expect(platformConfigSeed('p_brand_new')).toEqual(GENERIC_CONFIG_SEED)
  })

  it('hands back a copy, so editing a form cannot mutate the seed', () => {
    const cfg = platformConfigSeed('p_brand_new')
    cfg.storeName = 'Changed'
    expect(GENERIC_CONFIG_SEED.storeName).not.toBe('Changed')
  })
})
