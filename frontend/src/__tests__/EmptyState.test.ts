import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import EmptyState from '../components/EmptyState.vue'

describe('EmptyState Component', () => {
  it('renders title', () => {
    const wrapper = mount(EmptyState, {
      props: { title: 'No Data' }
    })
    expect(wrapper.text()).toContain('No Data')
  })

  it('renders custom icon', () => {
    const wrapper = mount(EmptyState, {
      props: { title: 'Empty', icon: '🎉' }
    })
    expect(wrapper.text()).toContain('🎉')
  })
})
