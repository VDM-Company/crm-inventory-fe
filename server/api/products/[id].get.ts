import type { StoredProduct } from '#shared/types'

export default defineEventHandler(event => getHandler<StoredProduct>(event, 'products'))
