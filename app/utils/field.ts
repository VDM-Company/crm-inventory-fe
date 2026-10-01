/**
 * `:ui` presets for UInput / UTextarea.
 *
 * The default theme in `app.config.ts` already matches the design's standard
 * field (12px/10px padding, 15px text). These cover the two tighter scales the
 * design uses, which used to come from `.form-compact .field-input` in
 * `main.css` — a selector Nuxt UI's markup never matches.
 *
 * `extraBase` must be a literal at the call site so Tailwind's scanner sees it.
 * Line height is pinned on the compact presets. It is otherwise inherited, and
 * UFormField's root is `text-sm`, so a field inside one would come out 1px
 * shorter than the identical field next to it.
 */

/** The two large product forms (Create New Product / Product Detail). */
export function fieldCompact(extraBase = '') {
  return { base: ('px-3 py-[9px] text-[14px]/[21px] md:text-[14px]/[21px] ' + extraBase).trim() }
}

/** The denser rows inside those forms (variant SKUs, fee amounts). */
export function fieldCompactSm(extraBase = '') {
  return { base: ('px-2.5 py-[7px] text-[13px]/[19.5px] md:text-[13px]/[19.5px] ' + extraBase).trim() }
}

/** A standard-scale field that still needs its own classes. */
export function fieldUi(extraBase: string) {
  return { base: extraBase }
}

/** `.form-compact` shrinks labels to 13px; UFormField needs it spelled out. */
export const FORM_FIELD_COMPACT = { label: 'text-[13px]' }
