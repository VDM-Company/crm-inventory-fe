import type { Platform } from '#shared/types'
import { platformUpdateSchema } from '#shared/schemas'

export default defineEventHandler(event => updateHandler<Platform>(event, 'platforms', platformUpdateSchema))
