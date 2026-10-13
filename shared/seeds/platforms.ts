import type { Platform } from '../types/domain'

/**
 * Mirrors the three platforms the Vertex Commerce mock serves, ids included.
 *
 * The ids are UUIDs from that mock rather than the readable `p_sp` of before,
 * so a product seeded here resolves against either seam while the screens
 * migrate one at a time. The trade is that this file is now tied to the
 * Postman mock's canned data: if that collection is re-exported with fresh
 * ids, these have to follow. `docs/api/vertex-commerce.postman_collection.json`
 * is the source.
 */
export const SKSIM_ID = '01a116c8-5d68-7007-a79d-4f65f606f29c'
export const SIMPOINT_ID = '01a116c8-5d82-73e5-9f80-a0e0cc8d42c5'
export const OLDSTORE_ID = '01a116c8-5da4-701e-b27e-4f7957b9338d'

/** Kept for the call sites that used it; there is no catch-all upstream. */
export const GENERAL_ID = OLDSTORE_ID

export const PLATFORM_SEED: Platform[] = [
  { id: OLDSTORE_ID, name: 'Old Store', code: 'OLDSTORE', url: 'old-store.example.jp' },
  { id: SIMPOINT_ID, name: 'SIM Point', code: 'SIMPOINT', url: 'sim-point.jp' },
  { id: SKSIM_ID, name: 'SK SIM', code: 'SKSIM', url: 'sk-sim.jp' }
]
