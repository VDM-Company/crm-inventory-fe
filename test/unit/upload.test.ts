import { describe, expect, it } from 'vitest'
import { storagePutInit } from '../../shared/utils/upload'
import { fromVertex } from '../../shared/utils/vertex-wire'
import type { VertexUpload } from '../../shared/types/vertex'

/** The collection's own 201 example for `POST /admin/uploads`. */
const WIRE_201 = {
  upload_id: '01a116c8-5e54-71ab-a433-a60e9b46fac1',
  url: 'https://uploads.sk-sim.jp/uploads/catalog_media/01a116c8.webp?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-SignedHeaders=content-type%3Bhost&X-Amz-Signature=f776',
  method: 'PUT',
  headers: { 'Content-Type': 'image/webp' },
  expires_at: '2026-10-07T15:33:12.532Z'
}

describe('the 201 through the case mapper', () => {
  it('leaves the HTTP header NAME alone', () => {
    // the signature covers the signed header names
    // (`SignedHeaders=content-type;host`), so a header renamed on the way in
    // is a header the bucket refuses. `Content-Type` survives because the
    // mapper only rewrites `_x`, and this is hyphenated — pinned here rather
    // than left as an argument
    const slot = fromVertex<VertexUpload>(WIRE_201)
    expect(slot.headers['Content-Type']).toBe('image/webp')
    expect(slot.headers).not.toHaveProperty('contentType')
  })

  it('camelCases the fields that ARE field names', () => {
    const slot = fromVertex<VertexUpload>(WIRE_201)
    expect(slot.uploadId).toBe('01a116c8-5e54-71ab-a433-a60e9b46fac1')
    expect(slot.expiresAt).toBe('2026-10-07T15:33:12.532Z')
  })

  it('leaves the signed URL untouched', () => {
    expect(fromVertex<VertexUpload>(WIRE_201).url).toBe(WIRE_201.url)
  })
})

describe('storagePutInit', () => {
  const slot = fromVertex<VertexUpload>(WIRE_201)

  it('follows the answer’s method and headers verbatim', () => {
    const init = storagePutInit(slot, 'bytes')
    expect(init.method).toBe('PUT')
    expect(init.headers).toEqual({ 'Content-Type': 'image/webp' })
  })

  it('sends NOTHING of ours to that host', () => {
    // a third-party host: no session cookie, and no Authorization — the
    // signature in the URL is the whole credential, and the upstream token
    // never leaves the server
    const init = storagePutInit(slot, 'bytes')
    expect(init.credentials).toBe('omit')
    expect(Object.keys(init.headers as object).map(k => k.toLowerCase())).not.toContain('authorization')
  })

  it('copies the headers rather than handing out the answer’s own object', () => {
    const init = storagePutInit(slot, 'bytes')
    ;(init.headers as Record<string, string>)['X-Injected'] = 'no'
    expect(slot.headers).not.toHaveProperty('X-Injected')
  })

  it('falls back to PUT when the answer names no method', () => {
    expect(storagePutInit({ ...slot, method: '' }, 'bytes').method).toBe('PUT')
    expect(storagePutInit({ ...slot, headers: undefined as never }, 'bytes').headers).toEqual({})
  })
})
