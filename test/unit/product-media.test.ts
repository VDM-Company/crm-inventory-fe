import { describe, expect, it } from 'vitest'
import {
  baseImageUrl,
  mediaBlockedReason,
  mediaChanged,
  mediaDraft,
  mediaPatch,
  mediaRemovals,
  toMediaEditor
} from '../../shared/utils/product-media'
import type { MediaItem } from '../../shared/utils/product-media'
import type { ProductMedia } from '../../shared/types/vertex'

const img = (over: Partial<ProductMedia> = {}): ProductMedia => ({
  id: 'med_1',
  role: 'gallery',
  url: 'https://cdn.example/1.webp',
  alt: null,
  sortOrder: 0,
  sizes: {},
  ...over
})

const item = (over: Partial<MediaItem> = {}): MediaItem => ({
  id: 'med_1',
  role: 'gallery',
  url: 'https://cdn.example/1.webp',
  alt: '',
  ...over
})

describe('toMediaEditor', () => {
  it('carries the id, which is what lets an image survive a save', () => {
    // `media` REPLACES the set: an image written back without its id is a
    // DIFFERENT image to the API, so the old one is deleted
    expect(toMediaEditor([img()])[0]!.id).toBe('med_1')
  })

  it('puts the base image first, whatever order it arrives in', () => {
    const rows = toMediaEditor([
      img({ id: 'g', role: 'gallery', sortOrder: 0 }),
      img({ id: 'b', role: 'base', sortOrder: 9 })
    ])
    expect(rows.map(r => r.id)).toEqual(['b', 'g'])
  })

  it('orders the rest by sortOrder', () => {
    const rows = toMediaEditor([
      img({ id: 'second', sortOrder: 2 }),
      img({ id: 'first', sortOrder: 1 })
    ])
    expect(rows.map(r => r.id)).toEqual(['first', 'second'])
  })

  it('resolves the alt text, and survives none', () => {
    expect(toMediaEditor([img({ alt: { en: 'Front of the SIM' } })])[0]!.alt).toBe('Front of the SIM')
    expect(toMediaEditor([img({ alt: null })])[0]!.alt).toBe('')
    expect(toMediaEditor(null)).toEqual([])
  })
})

describe('baseImageUrl', () => {
  it('is the base image, not merely the first one sent', () => {
    expect(baseImageUrl([
      img({ id: 'g', role: 'gallery', url: 'https://cdn.example/g.webp' }),
      img({ id: 'b', role: 'base', url: 'https://cdn.example/b.webp' })
    ])).toBe('https://cdn.example/b.webp')
  })

  it('falls back to the first when no image claims to be the base', () => {
    expect(baseImageUrl([img({ url: 'https://cdn.example/only.webp' })]))
      .toBe('https://cdn.example/only.webp')
  })

  it('is null when the product has no images', () => {
    expect(baseImageUrl([])).toBeNull()
    expect(baseImageUrl(undefined)).toBeNull()
  })
})

describe('mediaPatch', () => {
  it('is NULL when the images did not move', () => {
    // `[]` would delete every image, so an untouched save must send nothing
    expect(mediaPatch([item()], [item()])).toBeNull()
  })

  it('names a kept image by id and a new one by uploadId', () => {
    const saved = [item({ id: 'med_1', role: 'base' })]
    const draft = [item({ id: 'med_1', role: 'base' }), { role: 'gallery', url: 'blob:x', uploadId: 'up_9' }]
    expect(mediaPatch(saved, draft)).toEqual([
      { id: 'med_1', role: 'base' },
      { uploadId: 'up_9', role: 'gallery' }
    ])
  })

  it('sends the WHOLE list, including images the picker never touched', () => {
    // the hazard this exists for: sending only the changed one deletes the rest
    const saved = [item({ id: 'a', role: 'base' }), item({ id: 'b' })]
    const draft = [item({ id: 'a', role: 'base' }), item({ id: 'b' }), { role: 'gallery', url: 'blob:y', uploadId: 'up_c' }]
    expect(mediaPatch(saved, draft)!.map(m => m.id ?? m.uploadId)).toEqual(['a', 'b', 'up_c'])
  })

  it('sends an empty list when every image was removed, which is the delete', () => {
    expect(mediaPatch([item()], [])).toEqual([])
  })

  it('carries alt text, and leaves the key out when there is none', () => {
    const patch = mediaPatch([item()], [item({ alt: 'Front' })])
    expect(patch).toEqual([{ id: 'med_1', role: 'gallery', alt: { en: 'Front' } }])
    expect(mediaPatch([item()], [item({ role: 'base' })])![0]).not.toHaveProperty('alt')
  })

  it('notices a role change on its own', () => {
    expect(mediaPatch([item({ role: 'gallery' })], [item({ role: 'base' })]))
      .toEqual([{ id: 'med_1', role: 'base' }])
  })

  it('notices a reorder, which can change which image is the face', () => {
    const a = item({ id: 'a' })
    const b = item({ id: 'b' })
    expect(mediaChanged([a, b], [b, a])).toBe(true)
  })
})

describe('mediaRemovals', () => {
  it('names only images the product actually has', () => {
    const saved = [item({ id: 'a' }), item({ id: 'b' })]
    const draft = [item({ id: 'a' })]
    expect(mediaRemovals(saved, draft).map(m => m.id)).toEqual(['b'])
  })

  it('says nothing about a fresh pick removed before saving', () => {
    // it was never stored, so warning about it would be a warning about nothing
    const draft: MediaItem[] = []
    expect(mediaRemovals([{ role: 'base', url: 'blob:z', uploadId: 'up_1' }], draft)).toEqual([])
  })
})

describe('mediaBlockedReason', () => {
  it('refuses two base images, which the API would silently pick between', () => {
    expect(mediaBlockedReason([item({ id: 'a', role: 'base' }), item({ id: 'b', role: 'base' })]))
      .toContain('Only one image')
  })

  it('refuses a row that names no image yet', () => {
    expect(mediaBlockedReason([{ role: 'base', url: 'blob:q' }])).toContain('still uploading')
  })

  it('is null for a good set, including an empty one', () => {
    expect(mediaBlockedReason([item({ role: 'base' })])).toBeNull()
    expect(mediaBlockedReason([])).toBeNull()
  })
})

describe('mediaDraft', () => {
  it('sends fresh uploads only, because create has no ids to keep', () => {
    expect(mediaDraft([{ role: 'base', url: 'blob:a', uploadId: 'up_1' }]))
      .toEqual([{ uploadId: 'up_1', role: 'base' }])
  })

  it('is null when there is nothing to attach', () => {
    expect(mediaDraft([])).toBeNull()
    // an id-only row cannot exist on create, and must not become `{}`
    expect(mediaDraft([item({ id: 'med_1' })])).toBeNull()
  })
})

describe('the detail view’s image', () => {
  it('is filled from the product’s media rather than left blank', async () => {
    // the screen rendered a placeholder for every product, with or without
    // pictures, because nothing ever read `media`
    const { toDetailView } = await import('../../shared/utils/product-detail')
    const product = {
      id: 'p1',
      name: { en: 'Tourist SIM' },
      sku: 'TSIM-15GB',
      status: 'active',
      type: 'simple',
      media: [
        img({ id: 'g', role: 'gallery', url: 'https://cdn.example/g.webp' }),
        img({ id: 'b', role: 'base', url: 'https://cdn.example/b.webp' })
      ]
    }
    const view = toDetailView(product as never, null)
    expect(view.image).toBe('https://cdn.example/b.webp')
  })

  it('is null for a product with no pictures', async () => {
    const { toDetailView } = await import('../../shared/utils/product-detail')
    const view = toDetailView({ id: 'p1', name: { en: 'X' }, status: 'draft', type: 'simple', media: [] } as never, null)
    expect(view.image).toBeNull()
  })
})

describe('create attaches its uploads', () => {
  it('puts the picked images in the POST body', async () => {
    const { toProductDraft } = await import('../../shared/utils/product-create')
    const draft = toProductDraft({
      name: 'Tourist SIM', sku: '', notes: '', description: '', categoryId: '',
      platformIds: [], productType: 'single', stock: 'in_stock',
      isSubscription: false, notForSale: false,
      media: [{ role: 'base', url: 'blob:a', uploadId: 'up_1' }]
    })
    expect(draft.media).toEqual([{ uploadId: 'up_1', role: 'base' }])
  })

  it('leaves the key out when no image was picked', async () => {
    const { toProductDraft } = await import('../../shared/utils/product-create')
    const draft = toProductDraft({
      name: 'X', sku: '', notes: '', description: '', categoryId: '',
      platformIds: [], productType: 'single', stock: 'in_stock',
      isSubscription: false, notForSale: false
    })
    expect(draft).not.toHaveProperty('media')
  })
})
