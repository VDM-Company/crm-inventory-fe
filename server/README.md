# `server/api` — backend for frontend

```
app  ─────►  server/api  ─────►  Laravel API
            (this layer)        (not ready yet)
```

The browser never talks to Laravel directly. It calls same-origin `/api/*`,
which keeps the upstream URL and token on the server and lets us keep one
response shape regardless of what the upstream does.

## Two modes

| `NUXT_API_BASE_URL` | mode | behaviour |
| --- | --- | --- |
| empty (default) | `mock` | answers from an in-memory store seeded from `shared/seeds` |
| set | `proxy` | forwards to Laravel |

Check which is live: `curl localhost:3000/api/_health`.

The mock is **in-memory**: it resets when the server restarts and it is shared
by every visitor. Since the screens now read and write through it, restarting
the dev server discards anything created in the UI. It exists so the routes
return real shapes and real status codes before the upstream exists.

## Endpoints

Every resource has the same five routes. `:r` is one of
`products`, `categories`, `platforms`, `attributes`, `fees`.

| method | path | notes |
| --- | --- | --- |
| GET | `/api/:r` | `?page=&perPage=&q=&sort=&dir=` — all optional |
| POST | `/api/:r` | 201 on success |
| GET | `/api/:r/:id` | 404 if unknown |
| PUT | `/api/:r/:id` | partial update |
| DELETE | `/api/:r/:id` | 204 |

Sub-resources:

| method | path |
| --- | --- |
| GET / PUT | `/api/platforms/:id/config` |
| GET / PUT | `/api/categories/:id/products` |
| GET | `/api/_health` |

### Shapes

A list is always `{ data: T[], meta: { page, perPage, total, lastPage } | null }`.
`meta` is `null` when the request did not ask for pagination. Single records are
returned bare, not wrapped.

Errors carry `{ message, fieldErrors? }`. A 422 fills `fieldErrors` as
`{ field: message }`, which drops straight into UForm's `errors` prop —
see `apiFieldErrors()` in `app/composables/useApi.ts`.

## Before deploying with a token

`/api/*` has **no authentication**, and `nuxt.config.ts` still sets
`'/api/**': { cors: true }`. The whole UI now writes through it, so a deployed
instance is a shared store that any visitor — or any other website's
JavaScript — can modify. That is tolerable only on a dev machine. It is not harmless once `NUXT_API_TOKEN` is set: the route then
becomes an open proxy holding a privileged credential, and the CORS rule lets
any site's JavaScript drive it from a visitor's browser.

Before pointing this at a real API in any reachable environment:
- put auth in front of the routes (session, or forward the caller's own token)
- drop the `cors: true` rule — the app calls `/api` same-origin and never needed it

## Swapping in the real API

Everything that guesses at Laravel's wire format is in **one file**,
`server/utils/backend.ts`. The route handlers only call `backend()`, so they
should not need touching.

1. Set `NUXT_API_BASE_URL` (and `NUXT_API_TOKEN` if it uses bearer auth).
2. Work through the assumptions listed at the top of `backend.ts` and correct
   whichever are wrong. They are currently **unverified**:
   - responses wrapped in `{ data }`, paginators adding `{ meta }`
   - `meta` using `current_page` / `last_page` / `per_page` / `total`
   - snake_case fields (mapped automatically both ways)
   - 422 as `{ message, errors: { field: [msg] } }`
3. If the resource paths differ (`/products` vs `/inventory/products`), map them
   where `backend()` is called, or add a lookup in `backend.ts`.
4. Delete `server/utils/mock-db.ts` and its `shared/seeds` import once the
   placeholder is no longer wanted. The seeds are still used by `app/utils/*`,
   so keep `shared/seeds` itself.

## Layout

```
shared/types/domain.ts    domain shapes, used by app AND server
shared/types/api.ts       our wire contract (ApiList, ApiErrorBody, ...)
shared/schemas/           zod request validation, reusable by forms
shared/seeds/             seed rows, shared by the mock and app/utils
server/utils/backend.ts   THE SEAM — mock or proxy
server/utils/mock-db.ts   in-memory store
server/utils/crud.ts      shared handler bodies
server/utils/errors.ts    404 / 422 helpers
app/composables/useApi.ts typed client used by every screen
```

`shared/` cannot import from `app/` or `server/`, and cannot use Vue or Nuxt
runtime APIs — it compiles for both sides.
