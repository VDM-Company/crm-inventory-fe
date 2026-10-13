import type { Fee } from '#shared/types'

export default defineEventHandler(event => listHandler<Fee>(event, 'fees'))
