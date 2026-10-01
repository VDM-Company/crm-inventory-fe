import type { Category } from '#shared/types'

export default defineEventHandler(event => listHandler<Category>(event, 'categories'))
