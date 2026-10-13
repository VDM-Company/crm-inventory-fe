import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import VertexEmptyState from '~/components/vertex/EmptyState.vue'
import VertexErrorBanner from '~/components/vertex/ErrorBanner.vue'
import VertexLoadingPanel from '~/components/vertex/LoadingPanel.vue'
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
