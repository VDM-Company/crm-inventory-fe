import { describe, expect, it } from 'vitest'
import {
  vertexProductCreateSchema,
  vertexProductPlatformContentSchema,
  vertexProductUpdateSchema
} from '../../shared/schemas'

/*
 * `media` REPLACES the whole set on a write, so an image kept across a save
 * has to be named again by its `id`. The update shared create's schema, where
 * `uploadId` is required and `id` unknown, so "keep this image" was rejected
 * by this app before the API saw it — and the only media writes that could
 * pass were ones that deleted every existing image.
 */

const update = (media: unknown) => vertexProductUpdateSchema.safeParse({ lockVersion: 1, media })

describe('update media', () => {
  it('KEEPS an id, which is how an existing image survives the save', () => {
    const r = update([{ id: 'med_1', role: 'base' }])
    expect(r.success).toBe(true)
    // zod must not strip it: the server forwards whatever parse returns
    expect(r.data?.media).toEqual([{ id: 'med_1', role: 'base' }])
  })

  it('accepts a new image by uploadId', () => {
    const r = update([{ uploadId: 'up_1', role: 'gallery', alt: { en: 'Front' } }])
    expect(r.success).toBe(true)
    expect(r.data?.media?.[0]).toMatchObject({ uploadId: 'up_1', role: 'gallery' })
  })

  it('refuses an entry naming no image', () => {
    expect(update([{ role: 'base' }]).success).toBe(false)
  })

  it('refuses an entry naming two, which leaves the API to guess', () => {
    expect(update([{ id: 'med_1', uploadId: 'up_1' }]).success).toBe(false)
  })

  it('allows an empty list, which the API reads as "no images"', () => {
    expect(update([]).success).toBe(true)
  })

  it('takes the collection’s own PATCH example body', () => {
    const r = update([
      { id: '01a116c8-600e-7349-bde1-ae5c90cc4c19', role: 'base' },
      { uploadId: '01a116c8-5e64-70cb-a984-4f09f65a01d1', role: 'gallery', alt: { en: 'Japan Tourist SIM 15GB' } }
    ])
    expect(r.success).toBe(true)
    expect(r.data?.media).toHaveLength(2)
  })
})

describe('create media', () => {
  it('has no notion of id, because nothing exists yet', () => {
    const base = { name: { en: 'X' } }
    expect(vertexProductCreateSchema.safeParse({ ...base, media: [{ uploadId: 'up_1' }] }).success).toBe(true)
    expect(vertexProductCreateSchema.safeParse({ ...base, media: [{ id: 'med_1' }] }).success).toBe(false)
  })
})

describe('platform-content media', () => {
  it('names an image the same way, and refuses an entry naming none', () => {
    const body = (media: unknown) =>
      vertexProductPlatformContentSchema.safeParse({ lockVersion: 1, media })
    expect(body([{ id: 'med_1' }]).success).toBe(true)
    expect(body([{ uploadId: 'up_1' }]).success).toBe(true)
    expect(body([{ role: 'base' }]).success).toBe(false)
  })
})
