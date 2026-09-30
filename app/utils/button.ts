/**
 * Button family classes for `UButton`.
 *
 * The screens are pixel ports and the design has no single button scale (13
 * primary buttons use 8 different padding combinations), so UButton's `size`
 * variant cannot carry them. Instead every call site uses
 * `variant="ghost"` — which contributes no ring, background or border — and
 * supplies one of these family strings plus its own padding/text size:
 *
 *   <UButton variant="ghost" :ui="{ base: [BTN_PRIMARY, 'px-[18px] py-[9px] text-[15px]'] }" />
 *
 * `variant="ghost"` matters: UButton's `outline` variant draws a **ring** in
 * its own accent colour, not the design's `slate-200` border.
 */

/** Solid green call-to-action. */
export const BTN_PRIMARY = 'bg-green-500 text-white font-bold rounded-lg shadow-sm hover:bg-green-600 transition-colors'

/** White card button with the design's 1px slate border. */
export const BTN_OUTLINE = 'border border-slate-200 bg-white text-slate-700 font-semibold rounded-lg hover:bg-slate-50 transition-colors'

/** Destructive confirm. */
export const BTN_DANGER = 'bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition-colors'

/** Square icon button sitting on a card (bordered). */
export const BTN_ICON = 'btn-icon-hover border border-slate-200 bg-white rounded-lg inline-flex items-center justify-center'

/** Square icon button with no chrome until hover. */
export const BTN_ICON_GHOST = 'btn-icon-hover border-none bg-transparent rounded-lg inline-flex items-center justify-center'

/** Dashed "add another…" affordance. */
export const BTN_DASHED = 'inline-flex items-center gap-1.5 border border-dashed border-green-500 bg-emerald-50 text-green-600 font-semibold rounded-lg'
