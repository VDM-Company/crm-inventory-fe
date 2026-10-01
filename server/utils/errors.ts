import type { FieldErrors } from '#shared/types'

/** 404 with our error body. */
export function notFound(what: string) {
  return createError({
    statusCode: 404,
    statusMessage: 'Not Found',
    data: { message: `${what} not found` }
  })
}

/** 422 carrying per-field messages, shaped for UForm's `errors` prop. */
export function unprocessable(message: string, fieldErrors?: FieldErrors) {
  return createError({
    statusCode: 422,
    statusMessage: 'Unprocessable Content',
    data: { message, fieldErrors }
  })
}

/** Flatten a ZodError into `{ field: firstMessage }`. */
export function zodFieldErrors(err: unknown): FieldErrors {
  const out: FieldErrors = {}
  const issues = (err as { issues?: { path: (string | number)[], message: string }[] })?.issues
  if (!Array.isArray(issues)) return out
  for (const i of issues) {
    const key = i.path.join('.') || '_'
    if (!out[key]) out[key] = i.message
  }
  return out
}
