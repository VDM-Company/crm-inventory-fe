import type { VertexCategory, VertexCategoryPlatformContentPatch } from '#shared/types'
import { localized } from './localized'

/**
 * Per-platform overrides of a category.
 *
 * The Categories screen has had a scope picker for a while, and it only ever
 * reached half the page: product membership and order were written with a
 * `platformId`, while the category's own name and enabled flag went to the
 * Default `PATCH /admin/categories/:id` whatever the scope said. Renaming
 * under "SIM Point" renamed it for every platform.
 *
 * `PATCH /admin/categories/:id/platform-content/:platform` is the one that
 * overrides them, and like the product version it takes `reset` to hand a
 * field back to Default.
 */

/** What the panel edits, plus which fields this platform claims as its own. */
export interface CategoryDraft {
  name: string
  isEnabled: boolean
  /** Only meaningful on a platform scope. */
  nameOverridden: boolean
  enabledOverridden: boolean
}

/**
 * A category as the panel should show it for the scope on screen.
 *
 * On Default that is simply the category. On a platform it is the platform's
 * view, where each field reports whether the value is the platform's own or
 * inherited — which is what lets the panel say "Overridden" honestly instead
 * of showing the Default value under a platform's name.
 */
export function categoryDraftFor(
  cat: VertexCategory | null | undefined,
  isPlatformScope: boolean,
  locale = 'en'
): CategoryDraft {
  if (!cat) return { name: '', isEnabled: true, nameOverridden: false, enabledOverridden: false }

  const view = isPlatformScope ? cat.platform : null
  if (!view) {
    return {
      name: localized(cat.name, locale),
      isEnabled: cat.isEnabled !== false,
      nameOverridden: false,
      enabledOverridden: false
    }
  }

  return {
    name: localized(view.name.value, locale),
    isEnabled: view.isEnabled.value !== false,
    nameOverridden: view.name.source === 'platform',
    enabledOverridden: view.isEnabled.source === 'platform'
  }
}

/**
 * The platform-content PATCH, or null when nothing about the override moved.
 *
 * Two directions, and the second is the one a plain value diff misses:
 *
 * - a field this platform now claims, whose value differs from what it had,
 *   is sent;
 * - a field it used to claim and no longer does is named in `reset`, or the
 *   platform keeps the old override for good.
 *
 * A category name cannot be blank — the API answers 422 `name.en` required —
 * so blanking the field is not how an override is dropped. That needs the
 * explicit "use Default" the panel offers, which is what `nameOverridden`
 * carries.
 */
export function categoryContentPatch(
  saved: CategoryDraft,
  draft: CategoryDraft
): VertexCategoryPlatformContentPatch | null {
  const patch: VertexCategoryPlatformContentPatch = {}
  const reset: NonNullable<VertexCategoryPlatformContentPatch['reset']> = []

  if (draft.nameOverridden) {
    const name = draft.name.trim()
    if (name && (!saved.nameOverridden || name !== saved.name)) patch.name = { en: name }
  } else if (saved.nameOverridden) {
    reset.push('name')
  }

  if (draft.enabledOverridden) {
    if (!saved.enabledOverridden || draft.isEnabled !== saved.isEnabled) patch.isEnabled = draft.isEnabled
  } else if (saved.enabledOverridden) {
    reset.push('isEnabled')
  }

  if (reset.length) patch.reset = reset
  return Object.keys(patch).length ? patch : null
}

/**
 * The Default PATCH, or null when nothing moved.
 *
 * Separate from the platform one because they are different writes against
 * different versions, and the screen has to pick exactly one.
 */
export function categoryDefaultPatch(
  cat: VertexCategory | null | undefined,
  draft: CategoryDraft,
  locale = 'en'
): { name?: { en: string }, isEnabled?: boolean } | null {
  if (!cat) return null
  const patch: { name?: { en: string }, isEnabled?: boolean } = {}
  const name = draft.name.trim()
  if (name && name !== localized(cat.name, locale)) patch.name = { en: name }
  if (draft.isEnabled !== (cat.isEnabled !== false)) patch.isEnabled = draft.isEnabled
  return Object.keys(patch).length ? patch : null
}
