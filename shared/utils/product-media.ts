import type { ProductMedia, ProductMediaRef } from '#shared/types'

/**
 * A product's images, read and written.
 *
 * `media` on a write REPLACES the whole set — the same shape as a bundle's
 * contents, and the same hazard. An image the screen never showed is dropped
 * by a save that simply did not mention it, silently, with a 200. So the
 * editor carries every image the product has, `id` included, and the patch
 * sends the whole list back rather than the one the picker touched.
 *
 * `role` decides which one is the product's face: `base`. The API fills that
 * in itself when a list arrives without one — "without a base image the
 * first one is the base" — which is worth knowing because it means a
 * reordered list can change the face without anything saying so.
 */

/** One image as the editor holds it. */
export interface MediaItem {
  /** Set for an image the product already has; absent for one just uploaded. */
  id?: string
  /** Set for a fresh upload; absent for one the product already has. */
  uploadId?: string
  role: 'base' | 'gallery' | string
  /** Shown in the picker. An object URL for a fresh pick, the stored URL otherwise. */
  url: string
  alt?: string
}

/** The product's images, base first so the face of it reads first. */
export function toMediaEditor(media: ProductMedia[] | null | undefined, locale = 'en'): MediaItem[] {
  return [...(media || [])]
    .sort((a, b) => rank(a) - rank(b) || (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .map(m => ({
      id: m.id,
      role: m.role,
      url: m.url,
      alt: m.alt ? (m.alt[locale] ?? m.alt.en ?? '') : ''
    }))
}

const rank = (m: ProductMedia) => (m.role === 'base' ? 0 : 1)

/** The image shown as the product's own, or null when it has none. */
export function baseImageUrl(media: ProductMedia[] | null | undefined): string | null {
  const items = toMediaEditor(media)
  return items[0]?.url ?? null
}

/**
 * The `media` list for a write, or null when nothing about the images moved.
 *
 * Null rather than an empty list, and the difference matters: `[]` is a
 * instruction to delete every image, so a save that merely left the pictures
 * alone must not send one.
 */
export function mediaPatch(saved: MediaItem[], draft: MediaItem[]): ProductMediaRef[] | null {
  if (!mediaChanged(saved, draft)) return null
  return draft.map(m => ({
    ...(m.id ? { id: m.id } : { uploadId: m.uploadId }),
    role: m.role,
    ...(m.alt ? { alt: { en: m.alt } } : {})
  }))
}

/** Whether the set, its order, or any role or alt differs. */
export function mediaChanged(saved: MediaItem[], draft: MediaItem[]): boolean {
  return key(saved) !== key(draft)
}

const key = (items: MediaItem[]) =>
  items.map(m => [m.id ?? '', m.uploadId ?? '', m.role, m.alt ?? ''].join('~')).join('|')

/**
 * The images this save would delete.
 *
 * Only ones the product actually has: a fresh pick that is removed again
 * before saving was never stored, so naming it would be a warning about
 * nothing.
 */
export function mediaRemovals(saved: MediaItem[], draft: MediaItem[]): MediaItem[] {
  const kept = new Set(draft.map(m => m.id).filter(Boolean))
  return saved.filter(m => m.id && !kept.has(m.id))
}

/**
 * Why this set cannot be saved, or null.
 *
 * Two bases is the one a reader cannot see: both show as pictures, and the
 * API would pick one of them without saying which.
 */
export function mediaBlockedReason(items: MediaItem[]): string | null {
  const bases = items.filter(m => m.role === 'base').length
  if (bases > 1) return 'Only one image can be the product image.'
  if (items.some(m => !m.id && !m.uploadId)) return 'An image is still uploading.'
  return null
}

/**
 * The same list for a CREATE, where nothing exists to keep.
 *
 * Returns null when there are no images, because `POST /products` reads an
 * empty list as "no images" just as a patch does, and a Draft is better off
 * not mentioning them at all.
 */
export function mediaDraft(items: MediaItem[]): { uploadId: string, role?: string, alt?: { en: string } }[] | null {
  const fresh = items.filter(m => m.uploadId)
  if (!fresh.length) return null
  return fresh.map(m => ({
    uploadId: m.uploadId!,
    role: m.role,
    ...(m.alt ? { alt: { en: m.alt } } : {})
  }))
}
