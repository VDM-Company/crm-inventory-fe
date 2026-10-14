/**
 * Who is signed in, from the session cookie.
 *
 * Answered from the session rather than by asking the API on every page load:
 * the cookie is sealed and server-written, so it is as trustworthy as a round
 * trip and costs nothing. A token revoked upstream surfaces on the next real
 * call as a 401, which is where it is handled.
 */
export default defineEventHandler(async (event) => {
  return { user: await sessionUser(event) }
})
