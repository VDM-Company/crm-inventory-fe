import type { VertexUpload } from '#shared/types'

/**
 * Putting a file somewhere the API can reference it.
 *
 * Two steps, and only the first goes through this app: `POST /api/uploads`
 * asks for a pre-signed URL, then the BROWSER sends the bytes straight to
 * object storage. The file never passes through our server, which is why a
 * 10 MB image does not become a 10 MB request body here.
 *
 * The product then references `uploadId`. An upload nothing ends up
 * referencing expires by itself after 24 hours, so uploading before the
 * product exists leaves no mess to clean up when a save fails.
 */
export function useApiUploads() {
  const http = useApiFetch()

  /** Allowed by the API; checked here so a bad pick is refused before any request. */
  const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp']
  const MAX_BYTES = 10 * 1024 * 1024

  /** Why this file cannot be uploaded, in the words the picker shows. */
  function fileRejection(file: File): string | null {
    if (!ACCEPTED.includes(file.type)) return 'Images must be JPEG, PNG or WebP.'
    if (file.size > MAX_BYTES) return 'Images must be 10 MB or smaller.'
    if (!file.size) return 'That file is empty.'
    return null
  }

  /**
   * Upload a file and return the id the product references.
   *
   * The second request is a plain `fetch`, not `useApiFetch()`: it goes to
   * object storage, not to this app, and must carry none of our session.
   * `credentials: 'omit'` keeps the session cookie off a third-party host
   * even if the bucket ever shares a site with us.
   *
   * `method` and `headers` come from the answer rather than being assumed —
   * the signature covers both, so an invented `Content-Type` or an extra
   * header is rejected by the bucket.
   */
  async function upload(file: File, purpose = 'catalog_media'): Promise<VertexUpload> {
    const rejection = fileRejection(file)
    if (rejection) throw new Error(rejection)

    const slot = await http<VertexUpload>('/api/uploads', {
      method: 'POST',
      body: {
        filename: file.name,
        contentType: file.type,
        size: file.size,
        purpose
      }
    })

    const res = await fetch(slot.url, {
      method: slot.method || 'PUT',
      headers: slot.headers || {},
      body: file,
      credentials: 'omit',
      mode: 'cors'
    })
    if (!res.ok) {
      // the bucket answers XML, not our error envelope, so there is nothing
      // to unwrap — the status is the whole story a reader can act on
      throw new Error(`The image could not be stored (${res.status}).`)
    }

    return slot
  }

  return { upload, fileRejection, ACCEPTED, MAX_BYTES }
}
