/**
 * Shared `:ui` overrides that make Nuxt UI's `UTable` render as the Vertex
 * design's table: slate-50 header strip, 1px row dividers, hover tint, and the
 * `.th` header-cell identity from main.css.
 *
 * Per-column gutters and widths belong on the column def's
 * `meta.class.th` / `meta.class.td`, not here.
 *
 * `extraBase` must be passed as a LITERAL class string at the call site
 * (e.g. `tableUi('min-w-[640px]')`) so Tailwind's scanner can see it — never
 * build the class from a variable.
 */
export function tableUi(extraBase = '') {
  return {
    base: ('w-full border-collapse ' + extraBase).trim(),
    thead: 'bg-slate-50 [&>tr]:border-b [&>tr]:border-slate-200',
    // `[&>tr:has(>td:only-child)]:hidden` suppresses the empty filler row UTable
    // always emits for an expanded row when no `#expanded` slot is supplied —
    // this codebase renders sub-rows as real rows via `getSubRows` instead.
    tbody: 'divide-y-0 [&>tr]:border-b [&>tr]:border-slate-100 [&>tr]:hover:bg-slate-50 [&>tr:has(>td:only-child)]:hidden',
    // `font-bold text-slate-500` are spelled out rather than left to `.th`:
    // UTable's own `font-semibold text-highlighted` are utilities, and `.th`
    // lives in the components layer, so it would lose the cascade.
    th: 'th font-bold text-slate-500 text-left text-sm px-3 py-[13px]',
    td: 'px-3 py-3.5'
  }
}

/** First / last column gutter — the design uses px-5 at the table edges. */
export const TABLE_EDGE = { th: 'px-5', td: 'px-5' }
