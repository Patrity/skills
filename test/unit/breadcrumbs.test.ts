import { describe, expect, it } from 'vitest'
import type { BreadcrumbItem } from '@nuxt/ui'
import { compactBreadcrumbs } from '../../shared/utils/breadcrumbs'

const items = (...labels: string[]): BreadcrumbItem[] => labels.map(label => ({ label }))

describe('compactBreadcrumbs', () => {
  it.each([1, 2, 3, 4])('leaves %d items untouched', (n) => {
    const input = items(...Array.from({ length: n }, (_, i) => `c${i}`))
    expect(compactBreadcrumbs(input)).toBe(input)
  })

  it('collapses six items to four with an ellipsis in third place', () => {
    const input = items('Skills', 'Nuxt UI', 'skills', 'nuxt-ui-docs', 'sub', 'fetch.py')
    const out = compactBreadcrumbs(input)
    expect(out).toHaveLength(4)
    expect(out.map(i => i.label)).toEqual(['Skills', 'Nuxt UI', '…', 'fetch.py'])
  })

  it('preserves the last item and its properties', () => {
    const input: BreadcrumbItem[] = [
      { label: 'Skills', to: '/skills' },
      { label: 'Nuxt', to: '/skill/nuxt' },
      { label: 'rules' },
      { label: 'deep' },
      { label: 'web-nuxt.md' }
    ]
    const out = compactBreadcrumbs(input)
    expect(out[0]).toBe(input[0])
    expect(out[1]).toBe(input[1])
    expect(out[out.length - 1]).toBe(input[input.length - 1])
  })

  it('honours a custom max', () => {
    const input = items('a', 'b', 'c', 'd', 'e')
    expect(compactBreadcrumbs(input, 4)).toBe(input)
    expect(compactBreadcrumbs(input, 2).map(i => i.label)).toEqual(['a', 'b', '…', 'e'])
  })
})
