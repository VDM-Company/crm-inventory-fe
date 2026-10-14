import type { H3Event } from 'h3'
import type { SessionUser } from '#shared/utils/auth'

/**
 * Where the signed-in user's API token lives.
 *
 * **In a sealed, httpOnly cookie — never in the browser's reach.** The token
 * is a Sanctum personal access token with this administrator's full
 * permissions; anything that can read it can act as them. So:
 *
 * - `httpOnly`, so no script on the page can read it, including one injected
 *   through an XSS;
 * - sealed with `sessionPassword`, so the raw token is not sitting in
 *   plaintext in a cookie jar, a proxy log or a `har` file;
 * - `sessionHeader: false`, because h3 otherwise also accepts the session in
 *   an `x-h3-session` request header — a second way in that nothing here
 *   needs and that a caller could supply directly;
 * - `sameSite: 'lax'`, so another site cannot drive the API with the
 *   visitor's cookie. That is the same hole `cors: true` used to leave open.
 *
 * The browser therefore never holds the token. It holds an opaque cookie, and
 * `server/api` is the only thing that turns it back into an Authorization
 * header.
 */

/** A week. Long enough not to be a nuisance, short enough to expire. */
const MAX_AGE = 60 * 60 * 24 * 7

export interface VertexSession extends Record<string, unknown> {
  token?: string
  user?: SessionUser
}

function sessionConfig() {
  const password = String(useRuntimeConfig().sessionPassword || '')

  // Failing loudly beats sealing with a guessable key: h3 would happily use a
  // short one, and the seal would be decorative.
  if (password.length < 32) {
    throw createError({
      statusCode: 503,
      statusMessage: 'session_unconfigured',
      data: {
        message: 'NUXT_SESSION_PASSWORD must be set to at least 32 characters. '
          + 'Copy .env.example to .env and put a random value there.'
      }
    })
  }

  return {
    name: 'vertex_session',
    password,
    maxAge: MAX_AGE,
    // h3 would also read the session from `x-h3-session`; the cookie is the
    // only way in that this app wants
    sessionHeader: false as const,
    cookie: {
      httpOnly: true,
      sameSite: 'lax' as const,
      path: '/',
      // WebKit refuses to store a Secure cookie on http://localhost, so dev
      // would silently never stay signed in
      secure: !import.meta.dev,
      maxAge: MAX_AGE
    }
  }
}

export const vertexSession = (event: H3Event) => useSession<VertexSession>(event, sessionConfig())

/** The caller's API token, or '' when they are not signed in. */
export async function sessionToken(event: H3Event): Promise<string> {
  const session = await vertexSession(event)
  return session.data.token || ''
}

/** The caller, or null. */
export async function sessionUser(event: H3Event): Promise<SessionUser | null> {
  const session = await vertexSession(event)
  return session.data.user || null
}

export async function startSession(event: H3Event, token: string, user: SessionUser) {
  const session = await vertexSession(event)
  await session.update({ token, user })
}

/**
 * Ends the session on this side.
 *
 * Deliberately separate from revoking the token upstream: that call can fail,
 * and a user who clicked Log out has to end up logged out regardless.
 */
export async function endSession(event: H3Event) {
  const session = await vertexSession(event)
  await session.clear()
}
