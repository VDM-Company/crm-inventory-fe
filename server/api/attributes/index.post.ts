import type { AttributeDef } from '#shared/types'
import { attributeCreateSchema } from '#shared/schemas'

export default defineEventHandler(event => createHandler<AttributeDef>(event, 'attributes', attributeCreateSchema))
