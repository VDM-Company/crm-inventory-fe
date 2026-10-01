import type { Fee } from '#shared/types'

export default defineEventHandler(event => getHandler<Fee>(event, 'fees'))
