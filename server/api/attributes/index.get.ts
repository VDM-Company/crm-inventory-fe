import type { AttributeDef } from '#shared/types'

export default defineEventHandler(event => listHandler<AttributeDef>(event, 'attributes'))
