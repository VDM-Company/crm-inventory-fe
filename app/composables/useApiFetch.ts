/**
 * The fetch every resource binding calls `/api` through.
 *
 * It exists because the two halves of this app need different things from
 * `$fetch`, and neither built-in gives both:
 *
 * - **On the server** a plain `$fetch` carries none of the browser's cookies,
 *   so anything fetched during SSR arrives unauthenticated and 401s.
 *   `useRequestFetch()` forwards the incoming request's headers, which is
 *   what makes server-rendered data possible at all.
 * - **On the client** `useRequestFetch()` returns the `$fetch` captured when
 *   Nuxt's `#build/fetch` module was evaluated — which happens BEFORE
 *   plugins run. That is the original, not the one
 *   `app/plugins/auth-401.client.ts` installs, so using it everywhere would
 *   quietly disable the redirect that catches a session dying mid-visit.
 *
 * Hence: the request-bound fetch on the server, and `globalThis.$fetch` read
 * at CALL time on the client, so whatever the plugin installed is what runs.
 *
 * Must be called from a setup context — `useRequestFetch()` needs the current
 * request. Every binding calls it at the top of its own composable, which is
 * itself only called from setup.
 */
export function useApiFetch(): typeof $fetch {
  if (import.meta.server) return useRequestFetch() as typeof $fetch
  return ((request: Parameters<typeof $fetch>[0], options?: Parameters<typeof $fetch>[1]) =>
    globalThis.$fetch(request, options)) as typeof $fetch
}
