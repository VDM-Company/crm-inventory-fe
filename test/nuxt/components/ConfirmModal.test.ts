import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import VertexConfirmModal from '~/components/vertex/ConfirmModal.vue'

// UModal teleports its content, so assert against the document rather than the
// wrapper's own subtree.
const body = () => document.body.textContent || ''
const buttons = () => [...document.body.querySelectorAll('button')]

describe('VertexConfirmModal', () => {
  it('stays out of the document until it is opened', async () => {
    await mountSuspended(VertexConfirmModal, {
      props: { open: false, title: 'Delete Widget?', message: 'This cannot be undone.' }
    })
    expect(body()).not.toContain('Delete Widget?')
  })

  it('shows its title, message and both buttons when open', async () => {
    const c = await mountSuspended(VertexConfirmModal, {
      props: {
        open: true,
        title: 'Delete Widget?',
        message: 'This action cannot be undone.',
        cancelLabel: 'Cancel',
        confirmLabel: 'Delete'
      }
    })

    expect(body()).toContain('Delete Widget?')
    expect(body()).toContain('This action cannot be undone.')
    expect(buttons().map(b => b.textContent?.trim())).toEqual(expect.arrayContaining(['Cancel', 'Delete']))
    c.unmount()
  })

  it('hides the confirm button for a blocked delete, leaving only the way out', async () => {
    const c = await mountSuspended(VertexConfirmModal, {
      props: {
        open: true,
        title: 'Cannot delete widget',
        message: 'This widget is used by 2 products.',
        showConfirm: false,
        cancelLabel: 'Close'
      }
    })

    const labels = buttons().map(b => b.textContent?.trim())
    expect(labels).toContain('Close')
    expect(labels).not.toContain('Delete')
    c.unmount()
  })

  it('emits cancel and confirm from the two buttons', async () => {
    const c = await mountSuspended(VertexConfirmModal, {
      props: { open: true, title: 'Delete Widget?', cancelLabel: 'Cancel', confirmLabel: 'Delete' }
    })

    buttons().find(b => b.textContent?.trim() === 'Cancel')?.click()
    buttons().find(b => b.textContent?.trim() === 'Delete')?.click()
    await c.vm.$nextTick()

    expect(c.emitted('cancel')).toHaveLength(1)
    expect(c.emitted('confirm')).toHaveLength(1)
    c.unmount()
  })
})
