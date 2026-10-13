import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import VertexSelectMenu from '~/components/vertex/SelectMenu.vue'

const items = [
  { value: 'single', name: 'Single', selected: true },
  { value: 'variant', name: 'Variant' },
  { value: 'bundle', name: 'Bundle' }
]

describe('VertexSelectMenu', () => {
  it('shows the label and keeps the list closed', async () => {
    const c = await mountSuspended(VertexSelectMenu, { props: { open: false, label: 'Single', items } })

    expect(c.text()).toContain('Single')
    expect(c.text()).not.toContain('Variant')
  })

  it('renders every option once open', async () => {
    const c = await mountSuspended(VertexSelectMenu, { props: { open: true, label: 'Single', items } })
    const options = c.findAll('button').slice(1) // the first button is the trigger

    expect(options.map(o => o.text())).toEqual(['Single', 'Variant', 'Bundle'])
  })

  it('emits toggle from the trigger and select from an option', async () => {
    const c = await mountSuspended(VertexSelectMenu, { props: { open: true, label: 'Single', items } })
    const buttons = c.findAll('button')

    await buttons[0]!.trigger('click')
    expect(c.emitted('toggle')).toHaveLength(1)

    await buttons[2]!.trigger('click')
    expect(c.emitted('select')?.[0]).toEqual(['variant'])
  })

  it('closes when the backdrop is clicked', async () => {
    const c = await mountSuspended(VertexSelectMenu, { props: { open: true, label: 'Single', items } })

    await c.find('.fixed.inset-0').trigger('click')
    expect(c.emitted('close')).toHaveLength(1)
  })

  it('lets an item carry its own style, which the category tree uses to indent', async () => {
    const indented = [{ value: 'c1', name: 'Tourist SIM', style: 'padding-left:26px;' }]
    const c = await mountSuspended(VertexSelectMenu, { props: { open: true, label: 'x', items: indented } })

    expect(c.findAll('button')[1]!.attributes('style')).toContain('padding-left: 26px')
  })

  it('disables the trigger when locked, so it cannot be opened or focused', async () => {
    const c = await mountSuspended(VertexSelectMenu, {
      props: { open: false, label: 'In Stock', items, locked: true }
    })
    const trigger = c.find('button')

    expect(trigger.attributes('disabled')).toBeDefined()
    expect(trigger.attributes('style')).toContain('not-allowed')
  })

  it('greys the label when it is standing in for a placeholder', async () => {
    const c = await mountSuspended(VertexSelectMenu, {
      props: { open: false, label: 'Select category', items, placeholder: true }
    })

    expect(c.find('button span').classes()).toContain('text-slate-400')
  })

  it('renders the label, option and empty slots when given', async () => {
    const c = await mountSuspended(VertexSelectMenu, {
      props: { open: true, label: 'In Stock', items: [{ value: 'in', name: 'In Stock' }] },
      slots: {
        label: () => 'CUSTOM LABEL',
        option: ({ item }: { item: { name: string } }) => `DOT ${item.name}`,
        empty: () => 'Nothing left'
      }
    })

    expect(c.text()).toContain('CUSTOM LABEL')
    expect(c.text()).toContain('DOT In Stock')
    expect(c.text()).toContain('Nothing left')
  })
})
