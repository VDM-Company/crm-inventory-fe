# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Nuxt 4 dashboard app built on **Nuxt UI v4** (`@nuxt/ui`). A **Vertex Digital Marketing** product/inventory system, built by porting screens from a Claude Design project via the `DesignSync` MCP (see the `vertex-design-import` / `vertex-import-conventions` memories). The upstream Nuxt UI template pages/layout/components were deleted — only the Vertex screens remain. Package manager is **pnpm** (v11). Not a git repo yet.

## Commands

```bash
pnpm dev        # dev server on http://localhost:3000
pnpm build      # production build
pnpm preview    # preview prod build
pnpm lint       # eslint (Nuxt config, stylistic: no comma-dangle, 1tbs)
pnpm typecheck  # vue-tsc via nuxt typecheck
```

No test runner is configured. `postinstall` runs `nuxt prepare` (regenerates `.nuxt/`, required before typecheck/lint work).

## Architecture

Nuxt 4 `app/` directory layout. Auto-imports are on — do not manually import Vue APIs, `~/types`, `app/utils/*`, or components; refer to components by PascalCased path (e.g. `app/components/vertex/Sidebar.vue` → `<VertexSidebar>`).

- **Layout shell**: [app/layouts/default.vue](app/layouts/default.vue) is the base shell — `<VertexSidebar>` (collapsible grouped nav) + a content `<slot>`, DM Sans font. Every page renders in it by default. `/` redirects to `/dashboard` (routeRules in [nuxt.config.ts](nuxt.config.ts)).
- **Screens**: ported from Claude Design `*.dc.html` sources. [app/pages/dashboard.vue](app/pages/dashboard.vue) is the reference (stats grid + product table with rule-based filters, chips, pagination). See the `vertex-import-conventions` memory before porting more.
- **Types**: shared domain types in [app/types/index.d.ts](app/types/index.d.ts) (`Category`, `Platform`, `ProductRow`, `FilterRule`, `DashStat`, …). Import via `~/types`.
- **Data / stores**: no backend. Domain data lives in `app/utils/*.ts` modules (`categories.ts`, `platforms.ts` — ports of the design's `VertexCat`/`VertexPlatform`), persisted in `localStorage`. **SSR trap**: read `localStorage`/`Date.now()` only under `import.meta.client` or in `onMounted`, else hydration mismatch.

## Conventions

- Theme colors set in [app/app.config.ts](app/app.config.ts) (`primary: green`, `neutral: zinc`); the green palette is redefined as CSS vars in [app/assets/css/main.css](app/assets/css/main.css). Change brand color in both.
- Icons: `i-lucide-*` (Lucide) and `i-simple-icons-*` (brands), resolved by Iconify at build.
- Forms/validation: **zod v4** + Nuxt UI `UForm` / `UFormField`. Every `<input>` and `<textarea>` is a `UInput` / `UTextarea`, themed in [app/app.config.ts](app/app.config.ts) and sized by the presets in [app/utils/field.ts](app/utils/field.ts) (`fieldCompact` / `fieldCompactSm` on the two product forms, `fieldUi` elsewhere). `.field-input` in `main.css` now dresses the native `<select>`s only — don't reach for it on new fields.
- Two UInput traps: `@focus` is dropped (not an emit, and overridden internally) — use `@focusin`; and an absolutely-positioned prefix like the `¥` span needs `z-10`, because UInput's root is positioned and paints over it.
- Toggles are `USwitch`, sized in [app/app.config.ts](app/app.config.ts) (`md` 40x22, `sm` 38x22, `xl` 44x24). Bind the value only — `v-model`, or `:model-value` + `@update:model-value`; adding `@click` as well flips it twice. Its root is a block-level flex container, so add `class="inline-flex"` when the parent is `text-center` or a non-flex block, else the row loses ~5px and centring breaks.
- A native `<button>` inside a `UForm` needs `type="button"` — it defaults to submit.
- ESLint stylistic rules are enforced: **no comma dangle**, 1tbs brace style, max 3 attributes per line on single-line templates. Run `pnpm lint` before finishing.
