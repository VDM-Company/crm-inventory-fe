import type { H3Event } from 'h3'
import type { ZodType } from 'zod'

/**
 * Reads and validates a request body, turning a ZodError into our 422 shape.
 *
 * It is the one piece of the old placeholder seam that outlived it: the
 * handlers it used to sit beside spoke a guessed wire format and went through
 * `backend()`, but every Vertex route still parses its body this way.
 */
export async function parseBody<T>(event: H3Event, schema: ZodType<T>): Promise<T> {
  try {
    return await readValidatedBody(event, schema.parse)
  } catch (err) {
    const fieldErrors = zodFieldErrors((err as { data?: unknown }).data ?? err)
    if (Object.keys(fieldErrors).length) {
      throw unprocessable('The given data was invalid.', fieldErrors)
    }
    throw unprocessable('The request body could not be read.')
  }
}
