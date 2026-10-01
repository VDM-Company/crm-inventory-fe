import type { StoredProduct } from '#shared/types'
import { productUpdateSchema } from '#shared/schemas'

export default defineEventHandler(event => updateHandler<StoredProduct>(event, 'products', productUpdateSchema))
