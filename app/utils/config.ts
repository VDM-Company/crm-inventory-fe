import type { ConfigGroup, ConfigValues } from '~/types'
import { PLATFORM_CONFIG_SEED, GENERIC_CONFIG_SEED } from '#shared/seeds'

// Port of the design's Configuration screen store.
// Each platform owns its full set of values — there is no Default scope and no
// per-field override (that model was dropped in Master v3).

const KEY = 'vertex_platform_config_v1'

export const CONFIG_GROUPS: ConfigGroup[] = [
  { group: 'store', title: 'Store Information', icon: 'store', fields: [
    { key: 'storeName', label: 'Store Name', type: 'text', placeholder: 'e.g. Vertex Digital Marketing' },
    { key: 'phone', label: 'Phone', type: 'text', placeholder: 'e.g. +81 3-1234-5678' },
    { key: 'address', label: 'Address', type: 'textarea', placeholder: 'Street, city, postal code' }
  ] },
  { group: 'web', title: 'Web', icon: 'globe', fields: [
    { key: 'baseUrl', label: 'Base URL', type: 'text', placeholder: 'e.g. vdm.com', synced: true }
  ] },
  { group: 'contact', title: 'General Contact', icon: 'mail', fields: [
    { key: 'senderName', label: 'Sender Name', type: 'text', placeholder: 'e.g. VDM Support' },
    { key: 'senderEmail', label: 'Sender Email', type: 'text', placeholder: 'e.g. no-reply@vdm.com' }
  ] },
  { group: 'contactus', title: 'Contact Us', icon: 'message-circle', fields: [
    { key: 'contactEnabled', label: 'Enable Contact Us', type: 'toggle' },
    { key: 'contactEmail', label: 'Send Emails To', type: 'text', placeholder: 'e.g. support@vdm.com' }
  ] }
]

// Independent seed per platform — no base, each platform owns its full values.

export { PLATFORM_CONFIG_SEED, GENERIC_CONFIG_SEED } from '#shared/seeds'

// Deterministic — safe to call during SSR so a ref can be initialised with the
// same value the first client paint produces.
export function platformConfigSeed(platformId: string): ConfigValues {
  return { ...(PLATFORM_CONFIG_SEED[platformId] || GENERIC_CONFIG_SEED) }
}

function loadConfigAll(): Record<string, ConfigValues> {
  if (!import.meta.client) return {}
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}') || {}
  } catch {
    return {}
  }
}

export function loadPlatformConfig(platformId: string): ConfigValues {
  return { ...platformConfigSeed(platformId), ...(loadConfigAll()[platformId] || {}) }
}

export function savePlatformConfig(platformId: string, cfg: ConfigValues): void {
  if (!import.meta.client) return
  const all = loadConfigAll()
  all[platformId] = cfg
  try {
    localStorage.setItem(KEY, JSON.stringify(all))
  } catch {
    // ignore storage failure
  }
}
