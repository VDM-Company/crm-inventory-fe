/**
 * Leftover seed rows.
 *
 * They were the placeholder API's data: an in-memory store `server/api`
 * served before the Vertex Commerce API existed. That store is gone, and so
 * is every row here that only it read. What is still imported is the
 * platform CONFIG seed, which has no endpoint of its own yet, and a handful
 * of ids the Product Detail demo record still names.
 *
 * Not auto-imported — import from `#shared/seeds`.
 *
 * The ids are the Vertex mock's own, so anything seeded here resolves
 * against the real API. That ties this directory to
 * `docs/api/vertex-commerce.postman_collection.json`: if the collection is
 * re-exported with fresh ids, these follow.
 */
export { CATEGORY_SEED, SIM_CARDS_ID, TOURIST_SIM_ID, ESIM_ID, POCKET_WIFI_ID, ACCESSORIES_ID } from './categories'
export { PLATFORM_SEED, GENERAL_ID, SKSIM_ID, SIMPOINT_ID, OLDSTORE_ID } from './platforms'
export { ATTRIBUTE_SEED, ATTR_COLOR_ID, ATTR_DATA_ID, ATTR_NETWORK_ID, ATTR_VALIDITY_ID } from './attributes'
export { FEE_SEED, FEE_BASE_ID, FEE_TAX_ID, FEE_SHIPPING_ID } from './fees'
export { PLATFORM_CONFIG_SEED, GENERIC_CONFIG_SEED } from './config'
export { PRODUCT_SEED, TOURIST_SIM_PRODUCT_ID, TRAVEL_PACK_ID, POCKET_WIFI_PRODUCT_ID } from './products'
