import type { AuditLogEntry } from '#shared/types'
import { vertexAuditLogQuerySchema } from '#shared/schemas'

/** The Version History source. Narrow it with `subjectType` + `subjectId`. */
export default defineEventHandler(async (event) => {
  const query = await getValidatedQuery(event, vertexAuditLogQuerySchema.parse)
  return vertex(event).page<AuditLogEntry>('/admin/audit-logs', query as Record<string, unknown>)
})
