import type { VertexUpload } from '#shared/types'
import { vertexUploadSchema } from '#shared/schemas'

/**
 * Ask for somewhere to put a file.
 *
 * The bytes do not come through here: the answer carries a pre-signed URL on
 * object storage that the browser writes to directly, and the product then
 * references the returned `uploadId`. This route exists so the request is
 * authenticated by the session like every other, and so the size and type
 * limits are enforced before a file is read.
 */
export default defineEventHandler(async (event) => {
  const body = await parseBody(event, vertexUploadSchema)
  const created = await vertex(event).one<VertexUpload>('/admin/uploads', { method: 'POST', body })
  setResponseStatus(event, 201)
  return created
})
