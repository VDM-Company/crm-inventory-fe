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

One file per endpoint under `server/api/`, each a thin wrapper: parse the
body or query with a schema from `shared/schemas`, then call `vertex(event)`.

| area | paths |
| --- | --- |
| products | `/api/products`, `/:id`, `/:id/status`, `/restore`, `/duplicate` |
| pricing | `/:id/pricing`, `/:id/price-plans`, `/:id/pricing/platforms/:p/override`, `/reset` |
| variants | `/:id/variants/preview`, `/generate`, and `/api/products/variants/simulate` |
| bundles | `/:id/bundle-options`, `/:id/bundle-price` |
| content | `/:id/platform-content`, `/:id/platform-content/:platform` |
| categories | `/api/categories`, `/:id`, `/:id/products`, `/:id/platform-content/:platform` |
| platforms | `/api/platforms`, `/:id`, `/:id/settings`, `/activate`, `/deactivate` |
| attributes | `/api/attributes`, `/:id`, `/:id/options`, `/:id/options/:option`, `/options/order` |
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

## Authentication

Every `/api` route needs a session. The two exceptions are `/api/auth/login`
and `/api/_health`, matched exactly — `server/middleware/auth.ts` answers 401
to everything else.

**The upstream token never reaches the browser.** `POST /api/auth/login`
forwards the credentials and puts the Sanctum token under the session's
`secure` key. `nuxt-auth-utils` destructures that away before the session is
ever sent to the client (`const { secure, ...data } = session`), so what goes
back is the user's name, email, roles and permissions — no token.
`vertex(event)` reads the cookie and turns it into the Authorization header,
which is why that parameter is required rather than optional: there is no
shared credential to fall back on.

| route | does |
| --- | --- |
| `POST /api/auth/login` | credentials → session cookie; answers `{ user }` |
| `POST /api/auth/logout` | revokes upstream (best effort), always clears the session |
| `GET /api/_auth/session` | the module's own: the session without `secure` |

Two behaviours worth knowing:

- **Logout clears the local session even when the upstream call fails.** A
  user who clicked Log out has to end up logged out. Against the Postman mock
  that call always fails: its default saved example for logout is the 401.
- **A session-ending 401 clears the session** — `unauthenticated`,
  `token_expired` or `account_inactive`. A token revoked or expired while a
  tab is open would otherwise leave someone looking signed in while every
  screen failed. The decision is by `error.code`, never by status: any other
  401 belongs to the screen that asked. Deciding by status logged people out
  whenever they saved a price, because the mock answers that write with a
  saved 401 whose code is the literal string `"string"`.

`NUXT_SESSION_PASSWORD` seals the cookie and must be at least 32 characters;
the module writes a generated one into `.env` on the first dev run. Changing
it signs everyone out.

The module's own defaults are not enough, so `nuxt.config.ts` adds three —
each checked against its source and h3's rather than assumed:
`sessionHeader: false` (h3 otherwise accepts a sealed session in an
`x-nuxt-session` request header, which WINS over the cookie), `secure`
outside dev only, and a `maxAge`.

## Before deploying

The open-proxy problem is fixed: `/api/*` is behind a session, the cookie is
`sameSite: 'lax'`, and the `cors: true` rule is gone — the app calls `/api`
same-origin and never needed it.

What is left before this faces the internet:

- `secure` on the session cookie is tied to `import.meta.dev`, so production
  must actually be served over HTTPS for it to mean anything
- there is no rate limiting on `/api/auth/login` of our own; the API answers
  429 `rate_limited` and the login page counts it down, which is the whole of
  the protection
- `NUXT_SESSION_PASSWORD` has to be a real secret in the deployed
  environment, not the one from a developer's `.env`

## Layout

```
shared/types/vertex.ts     the Vertex API's documents
shared/types/domain.ts     presentation shapes used by app AND server
shared/types/api.ts        what is left of our own contract (FieldErrors)
shared/schemas/            zod request validation, from the collection
shared/utils/vertex-wire.ts  case mapping and error flattening (pure)
shared/utils/cursor.ts     the cursor walk (pure)
server/utils/vertex.ts     THE SEAM — config, the caller's token, HTTP, h3 errors
server/utils/session.ts    reads the token back out of the session's `secure`
server/middleware/auth.ts  401 for any guarded /api path without a session
shared/utils/auth.ts       which paths are guarded, and redirect safety (pure)
server/utils/vertex-crud.ts  shared handler bodies
server/utils/validate.ts   parseBody
server/utils/errors.ts     404 / 422 helpers
app/composables/useApi*.ts the typed clients the screens call
```

The pure halves live in `shared/` so they are tested directly rather than
through a copy of themselves. `shared/` cannot import from `app/` or
`server/`, and cannot use Vue or Nuxt runtime APIs — it compiles for both
sides.
