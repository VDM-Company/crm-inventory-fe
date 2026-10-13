import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import { defineVitestProject } from '@nuxt/test-utils/config'

export default defineConfig({
  test: {
    projects: [
      {
        // `app/utils/*` is pure enough to test without a Nuxt runtime, but two
        // of them import seeds through `#shared`, which only Nuxt resolves.
        resolve: {
          alias: {
            '#shared': fileURLToPath(new URL('./shared', import.meta.url))
          }
        },
        test: {
          name: 'unit',
          environment: 'node',
          include: ['test/unit/**/*.{test,spec}.ts']
        }
      },
      await defineVitestProject({
        test: {
          name: 'nuxt',
          environment: 'nuxt',
          include: ['test/nuxt/**/*.{test,spec}.ts'],
          /**
           * Each file in this project boots its own Nuxt environment in its
           * own worker — twelve of them on eight cores. Under that contention
           * the boot alone can pass vitest's 5s default, which showed up as a
           * handful of files timing out at random, always in this project and
           * never in `unit`. The tests themselves run in milliseconds; this
           * budget is for the environment, not for them.
           */
          testTimeout: 30_000,
          hookTimeout: 30_000
        }
      })
    ]
  }
})
