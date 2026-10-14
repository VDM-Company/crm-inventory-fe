import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import VertexEmptyState from '~/components/vertex/EmptyState.vue'
import VertexErrorBanner from '~/components/vertex/ErrorBanner.vue'
import VertexLoadingPanel from '~/components/vertex/LoadingPanel.vue'
import VertexPreviewGroup from '~/components/vertex/PreviewGroup.vue'
import VertexStatusBadge from '~/components/vertex/StatusBadge.vue'
import VertexTableSkeleton from '~/components/vertex/TableSkeleton.vue'
import VertexToast from '~/components/vertex/Toast.vue'

describe('VertexStatusBadge', () => {
  it('reads as active in green and inactive in slate', async () => {
    const on = await mountSuspended(VertexStatusBadge, { props: { active: true, label: 'Active' } })
    expect(on.text()).toBe('Active')
    expect(on.classes()).toContain('text-green-600')

    const off = await mountSuspended(VertexStatusBadge, { props: { active: false, label: 'Inactive' } })
    expect(off.classes()).toContain('text-slate-500')
  })
})

describe('VertexErrorBanner', () => {
  it('shows the message it is given', async () => {
    const c = await mountSuspended(VertexErrorBanner, { props: { message: 'Could not load platforms.' } })
    expect(c.text()).toContain('Could not load platforms.')
  })

  it('renders nothing without a message, so a healthy page stays clean', async () => {
    const c = await mountSuspended(VertexErrorBanner, { props: { message: '' } })
    expect(c.find('div').exists()).toBe(false)
  })
})

describe('VertexEmptyState', () => {
  it('renders the title, the hint and anything slotted in', async () => {
    const c = await mountSuspended(VertexEmptyState, {
      props: { icon: 'globe', title: 'No platforms yet', hint: 'Create your first platform.' },
      slots: { default: () => 'Create Platform' }
    })

    expect(c.text()).toContain('No platforms yet')
    expect(c.text()).toContain('Create your first platform.')
    expect(c.text()).toContain('Create Platform')
  })
})

describe('VertexLoadingPanel', () => {
  it('announces itself as busy so it is not read as content', async () => {
    const c = await mountSuspended(VertexLoadingPanel, { props: { label: 'Loading product…' } })

    expect(c.attributes('aria-busy')).toBe('true')
    expect(c.text()).toContain('Loading product…')
  })
})

describe('VertexTableSkeleton', () => {
  it('draws the requested number of placeholder rows', async () => {
    const c = await mountSuspended(VertexTableSkeleton, { props: { rows: 3, columns: ['40%', '60%'] } })

    expect(c.attributes('aria-busy')).toBe('true')
    const bars = c.findAll('.animate-pulse')
    expect(bars).toHaveLength(6) // 3 rows x 2 columns
    expect(bars[0]!.attributes('style')).toContain('width: 40%')
  })
})

describe('VertexToast', () => {
  it('appears only while there is a message', async () => {
    const hidden = await mountSuspended(VertexToast, { props: { message: null } })
    expect(hidden.text()).toBe('')

    const shown = await mountSuspended(VertexToast, { props: { message: 'Product created' } })
    expect(shown.text()).toContain('Product created')
  })
})

describe('VertexPreviewGroup', () => {
  const rows = [
    { id: 'a', label: 'Black / 8 Days', sku: 'X1-BLK-8D' },
    { id: 'b', label: 'White / 8 Days', sku: 'X1-WHT-8D' }
  ]

  it('lists every row with its label and SKU', async () => {
    const c = await mountSuspended(VertexPreviewGroup, {
      props: { tone: 'create', icon: 'i-lucide-plus', title: 'Create 2', rows }
    })
    expect(c.text()).toContain('Create 2')
    expect(c.text()).toContain('Black / 8 Days')
    expect(c.text()).toContain('X1-WHT-8D')
    expect(c.findAll('li')).toHaveLength(2)
  })

  it('colours a destructive group differently from an additive one', async () => {
    // the dialog's whole job is that "create 4" and "delete 2" cannot be
    // mistaken for each other at a glance
    const create = await mountSuspended(VertexPreviewGroup, {
      props: { tone: 'create', icon: 'i-lucide-plus', title: 'Create', rows }
    })
    const del = await mountSuspended(VertexPreviewGroup, {
      props: { tone: 'delete', icon: 'i-lucide-trash-2', title: 'Delete', rows }
    })
    expect(create.classes().join(' ')).toContain('emerald')
    expect(del.classes().join(' ')).toContain('red')
  })

  it('explains itself when given a subtitle, and stays quiet without one', async () => {
    const withSub = await mountSuspended(VertexPreviewGroup, {
      props: { tone: 'disable', icon: 'i-lucide-circle-slash', title: 'Switch off', subtitle: 'These have orders.', rows }
    })
    expect(withSub.text()).toContain('These have orders.')

    const without = await mountSuspended(VertexPreviewGroup, {
      props: { tone: 'keep', icon: 'i-lucide-check', title: 'Keep', rows }
    })
    expect(without.findAll('p')).toHaveLength(0)
  })
})
