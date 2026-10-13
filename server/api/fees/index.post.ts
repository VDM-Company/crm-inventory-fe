import type { Fee } from '#shared/types'
import { feeCreateSchema } from '#shared/schemas'

export default defineEventHandler(event => createHandler<Fee>(event, 'fees', feeCreateSchema))
