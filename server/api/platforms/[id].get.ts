import type { Platform } from '#shared/types'

export default defineEventHandler(event => getHandler<Platform>(event, 'platforms'))
