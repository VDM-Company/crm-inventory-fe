# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Nuxt 4 dashboard app built on **Nuxt UI v4** (`@nuxt/ui`). A **Vertex Digital Marketing** product/inventory system, built by porting screens from a Claude Design project via the `DesignSync` MCP (see the `vertex-design-import` / `vertex-import-conventions` memories). The upstream Nuxt UI template pages/layout/components were deleted — only the Vertex screens remain. Package manager is **pnpm** (v11).

## Commands

```bash
pnpm dev        # dev server on http://localhost:3000
pnpm build      # production build
pnpm preview    # preview prod build
pnpm lint       # eslint (Nuxt config, stylistic: no comma-dangle, 1tbs)
pnpm typecheck  # vue-tsc via nuxt typecheck
pnpm vitest run # vitest — two projects: `unit` (node) and `nuxt` (@nuxt/test-utils)
```

`postinstall` runs `nuxt prepare` (regenerates `.nuxt/`, required before typecheck/lint work).

**Adding a file under `app/composables/` or `shared/utils/` needs a dev-server restart.** The auto-import manifest is built at startup, and neither typecheck nor vitest sees the stale one — they build their own module graph. The symptom is a runtime "X is not a function", sometimes only as a toast that has already expired by the time you look.

## Architecture

Nuxt 4 `app/` directory layout. Auto-imports are on — do not manually import Vue APIs, `~/types`, `app/utils/*`, or components; refer to components by PascalCased path (e.g. `app/components/vertex/Sidebar.vue` → `<VertexSidebar>`).

- **Layout shell**: [app/layouts/default.vue](app/layouts/default.vue) is the base shell — `<VertexSidebar>` (collapsible grouped nav) + a content `<slot>`, DM Sans font. Every page renders in it by default. `/` redirects to `/dashboard` (routeRules in [nuxt.config.ts](nuxt.config.ts)).
- **Screens**: ported from Claude Design `*.dc.html` sources. [app/pages/dashboard.vue](app/pages/dashboard.vue) is the reference (stats grid + product table with rule-based filters, chips, pagination). See the `vertex-import-conventions` memory before porting more.
- **Types**: domain types (`Category`, `Platform`, `ProductRow`, …) live in [shared/types/domain.ts](shared/types/domain.ts) so `server/api` shares one definition; the Vertex API's own documents are in [shared/types/vertex.ts](shared/types/vertex.ts) (what is left of our own wire contract, `FieldErrors`, is in [shared/types/api.ts](shared/types/api.ts)). [app/types/index.d.ts](app/types/index.d.ts) re-exports them and adds presentation-only shapes (`FilterRule`, `DashStat`, `CategoryTreeRow`, …). App code still imports everything via `~/types`. `shared/` cannot import from `app/` or `server/`, and cannot use Vue or Nuxt runtime APIs.
- **Data / stores**: no localStorage. Every resource reads and writes through its own binding in `app/composables/` — `useApiProductsV2()`, `useApiCategoriesV2()`, `useApiPlatformsV2()`, `useApiAttributesV2()`, `useApiFeeItems()` — each a thin call to [useVertexResource.ts](app/composables/useVertexResource.ts), which keeps the resource name and the envelope in one place. **Add a resource by writing its `useApiX.ts`, not by passing a new string.** Products are the exception: `useApiProductsV2()` has no `list()`, only `page()`, because the catalogue is unbounded — and it carries the pricing, variant, bundle and platform-content endpoints beside the resource itself. The pure helpers over an already-loaded list (`categoryById`, `attributeNames`, usage counts) stay sync in `app/utils/*.ts`; the pure halves of a whole screen live in `shared/utils/` (`product-detail.ts`, `product-create.ts`, `variant-pricing.ts`, `product-row.ts`) so they can be tested directly. The only browser storage left is the sidebar's collapsed flag and a `sessionStorage` toast hand-off.
- **API layer**: `app → server/api → Vertex Commerce API`, described by [docs/api/vertex-commerce.postman_collection.json](docs/api/vertex-commerce.postman_collection.json). One seam, [server/utils/vertex.ts](server/utils/vertex.ts); handlers only call `vertex()`. Set `NUXT_VERTEX_API_BASE` **including the `/api/v1` prefix** (without it every path 404s) — copy `.env.example` to `.env`. The wire translation is pure and lives in [shared/utils/vertex-wire.ts](shared/utils/vertex-wire.ts) + [shared/utils/cursor.ts](shared/utils/cursor.ts), tested against the collection's own examples in `test/unit/`. Contract: `{data}` envelope, snake_case, **cursor pagination** (no page numbers — categories have none at all and return the whole tree), **PATCH** with a required `lock_version` (409 `stale_version`), integer JPY with no minor unit, localized fields as `{ en: … }` maps, errors as `{error:{code,message,details?}, errors?:{field:[{code,message}]}}`. The `-v2` in the route and binding names is left over from the migration and means nothing now. See [server/README.md](server/README.md).
  - **Trap: the case mapper renames keys, not values.** A field name carried as a VALUE (`reset: ['is_enabled']`, `lockedFields`, `sort: '-updated_at'`, `stockStatus: 'out_of_stock'`) stays in the API's spelling — translate it explicitly.
  - **Trap: the Postman mock proves almost nothing.** It ignores request bodies and path ids, persists nothing, and answers some writes with a saved *error* example (403 on `POST /products`, 401 on `POST /price-plans`). A body with a wrong key name comes back 201. That is why every mapping is unit-tested against the collection's example bodies rather than checked in the browser.
  - Saving a product is a **sequence**, and the first step commits: `POST /products` (always a Draft, no prices) → `POST /:id/price-plans` → `POST /:id/status`. A configurable parent is not sellable, so its prices go on its variants, which must be activated before it can be.

## Conventions

- Theme colors set in [app/app.config.ts](app/app.config.ts) (`primary: green`, `neutral: zinc`); the green palette is redefined as CSS vars in [app/assets/css/main.css](app/assets/css/main.css). Change brand color in both.
- Icons: `i-lucide-*` (Lucide) and `i-simple-icons-*` (brands), resolved by Iconify at build.
- Forms/validation: **zod v4** + Nuxt UI `UForm` / `UFormField`. Every control is a Nuxt UI component — `UInput` / `UTextarea` / `USelect` / `USwitch` — themed in [app/app.config.ts](app/app.config.ts) and sized by the presets in [app/utils/field.ts](app/utils/field.ts) (`fieldCompact` / `fieldCompactSm` on the two product forms, `fieldUi` elsewhere, `SELECT_FILTER` on the dashboard, `SELECT_ADD_VALUE` for the "+ Add value" pickers). There is no `.field-input` any more.
- `USelect` traps: Reka rejects `''` as an item value (it reserves `''` for "cleared"), so a real "all" choice needs a sentinel mapped back to `''` (see `ALL` in [app/pages/dashboard.vue](app/pages/dashboard.vue)) and a blank prompt becomes the `placeholder` prop. A menu-style picker that must not keep its value binds `null` (`NO_VALUE`), not `undefined` — `undefined` makes Reka go uncontrolled and the pick sticks on the trigger.
- Two UInput traps: `@focus` is dropped (not an emit, and overridden internally) — use `@focusin`; and an absolutely-positioned prefix like the `¥` span needs `z-10`, because UInput's root is positioned and paints over it.
- Toggles are `USwitch`, sized in [app/app.config.ts](app/app.config.ts) (`md` 40x22, `sm` 38x22, `xl` 44x24). Bind the value only — `v-model`, or `:model-value` + `@update:model-value`; adding `@click` as well flips it twice. Its root is a block-level flex container, so add `class="inline-flex"` when the parent is `text-center` or a non-flex block, else the row loses ~5px and centring breaks.
- A native `<button>` inside a `UForm` needs `type="button"` — it defaults to submit.
- ESLint stylistic rules are enforced: **no comma dangle**, 1tbs brace style, max 3 attributes per line on single-line templates. Run `pnpm lint` before finishing.
