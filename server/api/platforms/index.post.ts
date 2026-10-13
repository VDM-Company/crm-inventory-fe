import type { Platform } from '#shared/types'
import { platformCreateSchema } from '#shared/schemas'

export default defineEventHandler(event => createHandler<Platform>(event, 'platforms', platformCreateSchema))
