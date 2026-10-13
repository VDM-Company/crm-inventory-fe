import type { Platform } from '../types/domain'

/** The catch-all platform every product belongs to. */
export const GENERAL_ID = 'p_general'

export const PLATFORM_SEED: Platform[] = [
  { id: GENERAL_ID, name: 'General Website', code: 'general_website', url: 'vdm.com' },
  { id: 'p_sp', name: 'SIM Point', code: 'sim_point', url: 'vdm.com/sp-sim' },
  { id: 'p_sk', name: 'SK-SIM', code: 'sk_sim', url: 'vdm.com/sk-sim' }
]
