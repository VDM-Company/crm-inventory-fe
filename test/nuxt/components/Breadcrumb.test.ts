import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import VertexBreadcrumb from '~/components/vertex/Breadcrumb.vue'

// Sample for the `nuxt` project: mounts a real component in a Nuxt runtime, so
// auto-imports, the app config theme and `<NuxtLink>` all resolve.
describe('VertexBreadcrumb', () => {
  it('renders every crumb', async () => {
    const component = await mountSuspended(VertexBreadcrumb, {
      props: {
        items: [
          { label: 'Inventory', to: '/dashboard' },
          { label: 'Configuration' },
          { label: 'Attributes' }
        ]
      }
    })

    expect(component.text()).toContain('Inventory')
    expect(component.text()).toContain('Configuration')
    expect(component.text()).toContain('Attributes')
  })

  it('links the crumbs that have a route and leaves the rest as plain text', async () => {
    const component = await mountSuspended(VertexBreadcrumb, {
      props: {
        items: [
          { label: 'Inventory', to: '/dashboard' },
          { label: 'Attributes' }
        ]
      }
    })

    const links = component.findAll('a')
    expect(links).toHaveLength(1)
    expect(links[0]!.attributes('href')).toBe('/dashboard')
  })
})
