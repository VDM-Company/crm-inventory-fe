/**
 * Seed data for the placeholder API.
 *
 * It lives in `shared/` because two sides need the same rows: the browser
 * stores in `app/utils/*` (which still read and write localStorage) and the
 * in-memory mock the `server/api` layer serves while the Laravel API is not
 * ready. Not auto-imported — import from `#shared/seeds`.
 */
export { CATEGORY_SEED } from './categories'
export { PLATFORM_SEED, GENERAL_ID } from './platforms'
export { ATTRIBUTE_SEED } from './attributes'
export { FEE_SEED, FEE_BASE_ID } from './fees'
export { PLATFORM_CONFIG_SEED, GENERIC_CONFIG_SEED } from './config'
export { PRODUCT_SEED } from './products'
