import type { StoredProduct } from '#shared/types'

export default defineEventHandler(event => listHandler<StoredProduct>(event, 'products'))
