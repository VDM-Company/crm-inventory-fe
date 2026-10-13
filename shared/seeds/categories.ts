import type { Category } from '../types/domain'

/**
 * The Vertex Commerce mock's category tree, flattened to the shape the older
 * screens read, with its real ids.
 *
 * Shorter than the tree this replaced — the upstream mock seeds five
 * categories, not seventeen — because a seed that invents rows the API does
 * not have is what made the two seams disagree in the first place.
 */
export const SIM_CARDS_ID = '01a116c8-5f59-720a-8ab7-47b2ccb23a6a'
export const TOURIST_SIM_ID = '01a116c8-5f68-737f-8e64-ca7edc41f65a'
export const ESIM_ID = '01a116c8-5f76-7014-b8fe-f96f42462af0'
export const POCKET_WIFI_ID = '01a116c8-5f83-710b-9d23-4a66a96b21dd'
export const ACCESSORIES_ID = '01a116c8-5f92-7281-8786-6bbe1d9a5bb5'

export const CATEGORY_SEED: Category[] = [
  { id: SIM_CARDS_ID, name: 'SIM Cards', parentId: null, enabled: true },
  { id: TOURIST_SIM_ID, name: 'Tourist SIM', parentId: SIM_CARDS_ID, enabled: true },
  { id: ESIM_ID, name: 'eSIM', parentId: SIM_CARDS_ID, enabled: true },
  { id: POCKET_WIFI_ID, name: 'Pocket WiFi', parentId: null, enabled: true },
  { id: ACCESSORIES_ID, name: 'Accessories', parentId: null, enabled: true }
]
