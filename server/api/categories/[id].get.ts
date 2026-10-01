import type { Category } from '#shared/types'

export default defineEventHandler(event => getHandler<Category>(event, 'categories'))
