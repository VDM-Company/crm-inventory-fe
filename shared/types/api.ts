/**
 * What is left of the contract between the Nuxt app and `server/api`.
 *
 * It used to describe OUR shape — a page-numbered envelope that
 * `server/utils/backend.ts` translated the upstream into. That seam is gone:
 * the routes speak the Vertex Commerce API's own documents now, which
 * `shared/types/vertex.ts` describes. Only the error shape is still ours,
 * because it is what `createError({ data })` hands the screens.
 */

/** Per-field validation messages, shaped for Nuxt UI's UForm `errors`. */
export type FieldErrors = Record<string, string>
