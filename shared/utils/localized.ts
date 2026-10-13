import type { LocalizedText } from '#shared/types'

/**
 * Display text for a localized field.
 *
 * Lives in `shared/utils` rather than beside the type, because `shared/types`
 * is re-exported with `export type *` and a runtime value there ends up
 * auto-imported twice.
 *
 * Pure, so it can run in a computed. Falls back to the requested locale, then
 * to English, then to whatever single value is there — a half-translated row
 * should still render something rather than a blank cell.
 */
export function localized(text: LocalizedText | null | undefined, locale = 'en'): string {
  if (!text) return ''
  return text[locale] ?? text.en ?? Object.values(text)[0] ?? ''
}

/** What the API accepts for a fee item `code`; 422 `regex` otherwise. */
export const FEE_ITEM_CODE_PATTERN = /^[a-z0-9_]{2,50}$/
