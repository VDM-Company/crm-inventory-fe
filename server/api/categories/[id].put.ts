import type { Category } from '#shared/types'
import { categoryUpdateSchema } from '#shared/schemas'

export default defineEventHandler(event => updateHandler<Category>(event, 'categories', categoryUpdateSchema))
