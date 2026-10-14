# `server/api` — backend for frontend

```
app  ─────►  server/api  ─────►  Vertex Commerce API
            (this layer)
```

The browser never talks to the Vertex API directly. It calls same-origin
`/api/*`, which keeps the upstream URL and the bearer token on the server.

There used to be a second seam here — `server/utils/backend.ts` and an
in-memory mock — written against a guessed Laravel contract before the real
one existed. The screens moved onto the Vertex API one resource at a time,
and that seam went with the last of them. Nothing answers from memory any
more: without `NUXT_VERTEX_API_BASE` every route fails rather than inventing
a reply.

## Configuration

| variable | meaning |
| --- | --- |
| `NUXT_VERTEX_API_BASE` | upstream base URL, **including** the `/api/v1` prefix the collection's `baseUrl` carries |
| `NUXT_VERTEX_API_TOKEN` | Sanctum bearer token, server-only |

Check what is configured: `curl localhost:3000/api/_health`.

While no real backend is deployed, the base can point at the Postman mock.
Know what that mock does and does not do before trusting a green screen:

- **it ignores request bodies.** Any body at all comes back as the saved
  example, so a renamed or missing field is invisible. This is why the wire
  mapping is unit-tested against the collection's own example bodies.
- **it ignores path ids.** Asking for one product returns whichever product
  the canned example holds.
- **nothing persists.**
- **some writes answer with an error example by default** — `POST /products`
  returns 403 and `POST /price-plans` 401 — and the placeholder bodies say
  literally `"message": "string"`.

## Routes

Named `*-v2` while the older routes still existed; the suffix is now just a
name. One file per endpoint under `server/api/`, each a thin wrapper: parse
the body or query with a schema from `shared/schemas`, then call `vertex()`.

| area | paths |
| --- | --- |
| products | `/api/products-v2`, `/:id`, `/:id/status`, `/restore`, `/duplicate` |
| pricing | `/:id/pricing`, `/:id/price-plans`, `/:id/pricing/platforms/:p/override`, `/reset` |
| variants | `/:id/variants/preview`, `/generate`, and `/api/products-v2/variants/simulate` |
| bundles | `/:id/bundle-options`, `/:id/bundle-price` |
| content | `/:id/platform-content`, `/:id/platform-content/:platform` |
| categories | `/api/categories-v2`, `/:id`, `/:id/products`, `/:id/platform-content/:platform` |
| platforms | `/api/platforms-v2`, `/:id`, `/:id/settings`, `/activate`, `/deactivate` |
| attributes | `/api/attributes-v2`, `/:id`, `/:id/options`, `/:id/options/:option`, `/options/order` |
| fee items | `/api/fee-items`, `/:id` |

### Shapes

The Vertex documents pass through as they are, with one translation: keys are
snake_case upstream and camelCase here, both ways. **Keys only** — a field
name carried as a VALUE (`sort: '-updated_at'`, `lockedFields`, `reset:
['is_enabled']`) is not touched, so those are spelled the API's way.

Other things worth knowing before reading a handler:

- lists are cursor-paginated: `meta.nextCursor` / `prevCursor`, and `total`
  only when `includeTotal` is asked for, which is costly upstream
- updates are **PATCH** and carry `lockVersion`; a stale one is 409
  `stale_version`
- money is **integer JPY** — there is no minor unit
- localized fields are `{ en: "..." }` maps
- a price plan's recurring line is its own kind: `lineType: 'monthly'`, with
  the price in `amountMonthly` and `amount` stored as 0

Errors come back as `{ error: { code, message, details? }, errors? }` and are
flattened into the `{ message, fieldErrors }` the screens read — see
`vertexErrorData()` in `shared/utils/vertex-wire.ts` and `apiFieldErrors()`
in `app/composables/useApi.ts`.

## Before deploying

`/api/*` has **no authentication**, and `nuxt.config.ts` sets
`'/api/**': { cors: true }`. That is not harmless once
`NUXT_VERTEX_API_TOKEN` is set: the route becomes an open proxy holding a
privileged credential, and the CORS rule lets any site's JavaScript drive it
from a visitor's browser.

Before pointing this at a real API in any reachable environment:

- put auth in front of the routes (a session, or forward the caller's own
  token — there is no login flow in this app yet)
- drop the `cors: true` rule; the app calls `/api` same-origin and never
  needed it

## Layout

```
shared/types/vertex.ts     the Vertex API's documents
shared/types/domain.ts     presentation shapes used by app AND server
shared/types/api.ts        what is left of our own contract (FieldErrors)
shared/schemas/            zod request validation, from the collection
shared/utils/vertex-wire.ts  case mapping and error flattening (pure)
shared/utils/cursor.ts     the cursor walk (pure)
server/utils/vertex.ts     THE SEAM — config, token, HTTP, h3 errors
server/utils/vertex-crud.ts  shared handler bodies
server/utils/validate.ts   parseBody
server/utils/errors.ts     404 / 422 helpers
app/composables/useApi*.ts the typed clients the screens call
```

The pure halves live in `shared/` so they are tested directly rather than
through a copy of themselves. `shared/` cannot import from `app/` or
`server/`, and cannot use Vue or Nuxt runtime APIs — it compiles for both
sides.
