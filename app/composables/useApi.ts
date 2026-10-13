/**
 * Typed client for `server/api`.
 *
 * What is left after the resource bindings took over CRUD and the dead
 * helpers were removed: the error readers the screens share, and `apiPutRaw`
 * for the two sub-resources that are not CRUD (`platforms/:id/config`,
 * `categories/:id/products`).
 *
 * `apiFieldErrors` currently has no caller. It stays because the server still
 * shapes 422s for it — `unprocessable()` in `server/utils/errors.ts`, the
 * Vertex seam's `fieldErrors`, and `server/README.md` all point at it. A form
 * that wires 422s into UForm's `errors` prop is the next thing that needs it;
 * if the cutovers end without one, the reader and the producers should go
 * together.
 */
import type { FieldErrors } from '#shared/types'

export function apiPutRaw<T>(path: string, body: unknown) {
  return $fetch<T>(`/api/${path}`, { method: 'PUT', body: body as Record<string, unknown> })
}

/**
 * Pull `fieldErrors` off a failed request so they can go straight into
 * UForm's `errors` prop. Returns `{}` for anything that is not a 422.
 */
export function apiFieldErrors(err: unknown): FieldErrors {
  const data = (err as { data?: { data?: { fieldErrors?: FieldErrors }, fieldErrors?: FieldErrors } })?.data
  return data?.data?.fieldErrors ?? data?.fieldErrors ?? {}
}

/** Human-readable message from a failed request. */
export function apiErrorMessage(err: unknown, fallback = 'Something went wrong.'): string {
  const data = (err as { data?: { data?: { message?: string }, message?: string } })?.data
  return data?.data?.message ?? data?.message ?? fallback
}

/**
 * The upstream's own error code — `stale_version`, `in_use`,
 * `system_fee_item`, … — for screens that react differently per code rather
 * than just showing the message.
 *
 * Only the Vertex seam sets this; the older one leaves it undefined.
 */
export function apiErrorCode(err: unknown): string | undefined {
  const data = (err as { data?: { data?: { code?: string }, code?: string } })?.data
  return data?.data?.code ?? data?.code
}
