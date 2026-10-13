/**
 * Seed data for the placeholder API.
 *
 * It lives in `shared/` because two sides need the same rows: the screens that
 * render before their fetch resolves, and the in-memory mock `server/api`
 * serves for the resources that have not moved to the Vertex Commerce API yet.
 * Not auto-imported — import from `#shared/seeds`.
 *
 * The ids here are the Vertex mock's own, so a product seeded on this side
 * resolves against either seam while the screens migrate one at a time. That
 * ties this directory to `docs/api/vertex-commerce.postman_collection.json`:
 * if the collection is re-exported with fresh ids, these follow.
 */
export { CATEGORY_SEED, SIM_CARDS_ID, TOURIST_SIM_ID, ESIM_ID, POCKET_WIFI_ID, ACCESSORIES_ID } from './categories'
export { PLATFORM_SEED, GENERAL_ID, SKSIM_ID, SIMPOINT_ID, OLDSTORE_ID } from './platforms'
export { ATTRIBUTE_SEED, ATTR_COLOR_ID, ATTR_DATA_ID, ATTR_NETWORK_ID } from './attributes'
export { FEE_SEED, FEE_BASE_ID, FEE_TAX_ID, FEE_SHIPPING_ID } from './fees'
export { PLATFORM_CONFIG_SEED, GENERIC_CONFIG_SEED } from './config'
export { PRODUCT_SEED } from './products'
