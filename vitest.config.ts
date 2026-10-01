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
          include: ['test/nuxt/**/*.{test,spec}.ts']
        }
      })
    ]
  }
})
