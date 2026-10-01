import type { Fee } from '#shared/types'
import { feeUpdateSchema } from '#shared/schemas'

export default defineEventHandler(event => updateHandler<Fee>(event, 'fees', feeUpdateSchema))
