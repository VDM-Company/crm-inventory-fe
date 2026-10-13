import type { AttributeDef } from '#shared/types'
import { attributeUpdateSchema } from '#shared/schemas'

export default defineEventHandler(event => updateHandler<AttributeDef>(event, 'attributes', attributeUpdateSchema))
