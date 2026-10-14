import type { H3Event } from 'h3'

/**
 * The signed-in user's API token.
 *
 * `nuxt-auth-utils` owns the session itself; this is the one thing the rest
 * of `server/` needs from it. The token lives under `secure`, which the
 * module's session endpoint destructures away before answering the browser
 * (`const { secure, ...data } = session`) — that is what keeps a Sanctum
 * token with this administrator's full permissions out of the page.
 *
 * Returns '' when nobody is signed in, which is what `vertex()` treats as
 * "send no Authorization header".
 */
export async function sessionToken(event: H3Event): Promise<string> {
  const session = await getUserSession(event)
  return session.secure?.token || ''
}
