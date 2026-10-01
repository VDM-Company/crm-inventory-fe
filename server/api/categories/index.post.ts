import type { Category } from '#shared/types'
import { categoryCreateSchema } from '#shared/schemas'

export default defineEventHandler(event => createHandler<Category>(event, 'categories', categoryCreateSchema))
