import type { VertexUpload } from '#shared/types'

/**
 * The one request this app makes to a host that is not its own.
 *
 * `POST /admin/uploads` answers with a pre-signed URL, and the browser sends
 * the bytes straight to object storage. The signature covers the method and
 * the signed header names (`SignedHeaders=content-type;host`), so the answer
 * is followed verbatim: a header we invented, or one we dropped, is rejected
 * by the bucket rather than quietly ignored.
 *
 * Pure and separate from the composable so the thing that decides what
 * leaves the browser can be read and tested on its own.
 */
export function storagePutInit(slot: VertexUpload, body: BodyInit): RequestInit {
  return {
    method: slot.method || 'PUT',
    headers: { ...(slot.headers || {}) },
    body,
    /*
     * Nothing of ours goes to that host. `omit` keeps the session cookie off
     * it even if the bucket ever shares a site with this app, and there is
     * deliberately no Authorization header: the signature in the URL is the
     * whole credential, and our upstream token must never leave the server.
     */
    credentials: 'omit',
    mode: 'cors'
  }
}
