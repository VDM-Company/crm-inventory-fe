/**
 * The shape of the session `nuxt-auth-utils` keeps.
 *
 * `User` is what reaches the browser. `SecureSessionData` does not: the
 * module's session endpoint destructures it away before answering
 * (`const { secure, ...data } = session`), which is where the API token
 * lives and why it never leaves the server.
 */
declare module '#auth-utils' {
  interface User {
    id: string
    name: string
    email: string
    roles: string[]
    permissions: string[]
  }

  interface UserSession {
    user?: User
  }

  interface SecureSessionData {
    /** Sanctum personal access token. Server-only, by the module's contract. */
    token: string
  }
}

export {}
