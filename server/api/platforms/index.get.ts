import type { Platform } from '#shared/types'

export default defineEventHandler(event => listHandler<Platform>(event, 'platforms'))
