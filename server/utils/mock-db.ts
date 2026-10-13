/**
 * In-memory stand-in for the Laravel API.
 *
 * Caveats, by design:
 *  - state lives in the Node process, so it RESETS on every server restart
 *  - it is shared by every visitor, not per-user
 *  - it is independent of the browser's localStorage, which the app's own
 *    `app/utils/*` stores still use
 * It exists so `server/api` has something to answer with, and so the response
 * shapes and status codes are real while the upstream is being built.
 */
import type { ApiList, ListQuery } from '#shared/types'
import type { Backend } from './backend'
import {
  ATTRIBUTE_SEED,
  CATEGORY_SEED,
  FEE_SEED,
  PLATFORM_CONFIG_SEED,
  PLATFORM_SEED,
  PRODUCT_SEED
} from '#shared/seeds'

type Row = Record<string, unknown> & { id?: string }

/** resource name -> rows. Cloned from the seeds on first touch. */
const tables = new Map<string, Row[]>()
/** singleton sub-resources, keyed by their full path. */
const singletons = new Map<string, unknown>()

const SEEDS: Record<string, unknown[]> = {
  products: PRODUCT_SEED,
  categories: CATEGORY_SEED,
  platforms: PLATFORM_SEED,
  attributes: ATTRIBUTE_SEED,
  fees: FEE_SEED
}

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T

function table(resource: string): Row[] {
  let t = tables.get(resource)
  if (!t) {
    const seed = SEEDS[resource]
    if (!seed) throw notFound(`Resource '${resource}'`)
    t = clone(seed) as Row[]
    tables.set(resource, t)
  }
  return t
}

function singleton(path: string, seed: () => unknown): unknown {
  if (!singletons.has(path)) singletons.set(path, clone(seed()))
  return singletons.get(path)
}

/** `products` -> `p`, so generated ids look like the seeded ones. */
function nextId(resource: string): string {
  return `${resource.slice(0, 1)}_${Math.random().toString(36).slice(2, 9)}`
}

function paginate<T>(rows: T[], query?: ListQuery): ApiList<T> {
  const perPage = Number(query?.perPage) || 0
  if (!perPage) return { data: rows, meta: null }
  const page = Math.max(1, Number(query?.page) || 1)
  const start = (page - 1) * perPage
  return {
    data: rows.slice(start, start + perPage),
    meta: {
      page,
      perPage,
      total: rows.length,
      lastPage: Math.max(1, Math.ceil(rows.length / perPage))
    }
  }
}

function search<T extends Row>(rows: T[], q?: string): T[] {
  if (!q) return rows
  const needle = q.trim().toLowerCase()
  if (!needle) return rows
  return rows.filter(r =>
    ['name', 'sku', 'code', 'reference'].some((k) => {
      const v = r[k]
      return typeof v === 'string' && v.toLowerCase().includes(needle)
    })
  )
}

function sortRows<T extends Row>(rows: T[], query?: ListQuery): T[] {
  const key = query?.sort
  if (!key) return rows
  const dir = query.dir === 'desc' ? -1 : 1
  return [...rows].sort((a, b) => {
    const x = a[key] as string | number | undefined
    const y = b[key] as string | number | undefined
    if (x === y) return 0
    return (x! > y! ? 1 : -1) * dir
  })
}

export function mockBackend(): Backend {
  return {
    mode: 'mock',

    async list<T>(resource: string, query?: ListQuery) {
      const rows = sortRows(search(table(resource), query?.q), query)
      return clone(paginate(rows, query)) as ApiList<T>
    },

    async get<T>(resource: string, id: string) {
      const row = table(resource).find(r => r.id === id)
      if (!row) throw notFound(`${resource}/${id}`)
      return clone(row) as T
    },

    async create<T>(resource: string, body: unknown) {
      const t = table(resource)
      const row = { ...(body as Row) }
      if (!row.id) row.id = nextId(resource)
      if (t.some(r => r.id === row.id)) {
        throw unprocessable('A record with this id already exists.', { id: 'Already taken.' })
      }
      t.unshift(row)
      return clone(row) as T
    },

    async update<T>(resource: string, id: string, body: unknown) {
      const t = table(resource)
      const i = t.findIndex(r => r.id === id)
      if (i < 0) throw notFound(`${resource}/${id}`)
      t[i] = { ...t[i], ...(body as Row), id }
      return clone(t[i]) as T
    },

    async remove(resource: string, id: string) {
      const t = table(resource)
      const i = t.findIndex(r => r.id === id)
      if (i < 0) throw notFound(`${resource}/${id}`)
      t.splice(i, 1)
    },

    async getRaw<T>(path: string) {
      const cfg = path.match(/^platforms\/([^/]+)\/config$/)
      if (cfg) {
        const id = cfg[1]!
        if (!table('platforms').some(p => p.id === id)) throw notFound(`platforms/${id}`)
        return clone(singleton(path, () => PLATFORM_CONFIG_SEED[id] ?? {})) as T
      }
      const mem = path.match(/^categories\/([^/]+)\/products$/)
      if (mem) {
        const id = mem[1]!
        if (!table('categories').some(c => c.id === id)) throw notFound(`categories/${id}`)
        return clone(singleton(path, () => ({ members: [], scopes: {} }))) as T
      }
      throw notFound(path)
    },

    async putRaw<T>(path: string, body: unknown) {
      await this.getRaw(path)
      singletons.set(path, clone(body))
      return clone(body) as T
    }
  }
}
