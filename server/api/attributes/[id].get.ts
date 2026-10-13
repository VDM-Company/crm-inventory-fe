import type { AttributeDef } from '#shared/types'

export default defineEventHandler(event => getHandler<AttributeDef>(event, 'attributes'))
