import type { StoredProduct } from '#shared/types'
import { productCreateSchema } from '#shared/schemas'

export default defineEventHandler(event => createHandler<StoredProduct>(event, 'products', productCreateSchema))
