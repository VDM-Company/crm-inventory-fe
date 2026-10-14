import type { AuditLogEntry, AuditLogQuery, VertexList } from '#shared/types'

/**
 * The audit log — the source of every Version History panel.
 *
 * Read-only by nature: entries are written by the API as a side effect of
 * doing things, never by a client.
 */
export function useApiAuditLogs() {
  const http = useApiFetch()

  /** One page, newest first. */
  const page = (query?: AuditLogQuery) =>
    http<VertexList<AuditLogEntry>>('/api/audit-logs', { query: query as Record<string, unknown> })

  /**
   * A whole record's history — a product with its SKUs, pricing, stock and
   * bundle options. Entries about a variant are filed under its parent, so
   * this is the parent's id.
   */
  const forSubject = (type: string, id: string, limit = 25) =>
    page({ subjectType: type, subjectId: id, limit }).then(r => r.data ?? [])

  return { page, forSubject }
}
