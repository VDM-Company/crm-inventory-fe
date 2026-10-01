import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import VertexField from '~/components/vertex/Field.vue'

describe('VertexField', () => {
  it('labels the control in its slot', async () => {
    const c = await mountSuspended(VertexField, {
      props: { label: 'Category Name' },
      slots: { default: '<input>' }
    })

    expect(c.find('label').text()).toContain('Category Name')
    expect(c.find('input').exists()).toBe(true)
  })

  it('marks a required field with an asterisk', async () => {
    const c = await mountSuspended(VertexField, { props: { label: 'Name', required: true } })
    expect(c.find('label').text()).toContain('*')

    const optional = await mountSuspended(VertexField, { props: { label: 'Name' } })
    expect(optional.find('label').text()).not.toContain('*')
  })

  it('shows a hint, and replaces it with the error once there is one', async () => {
    const hint = await mountSuspended(VertexField, { props: { label: 'Name', hint: 'Shown on the storefront.' } })
    expect(hint.text()).toContain('Shown on the storefront.')

    const error = await mountSuspended(VertexField, {
      props: { label: 'Name', hint: 'Shown on the storefront.', error: 'Name is required.' }
    })
    expect(error.text()).toContain('Name is required.')
    expect(error.text()).not.toContain('Shown on the storefront.')
  })

  it('omits the label element when there is no label', async () => {
    const c = await mountSuspended(VertexField, { slots: { default: '<input>' } })
    expect(c.find('label').exists()).toBe(false)
  })
})
