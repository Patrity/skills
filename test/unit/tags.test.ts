import { describe, expect, it } from 'vitest'
import { tagCounts } from '../../shared/utils/tags'

describe('tagCounts', () => {
  it('counts every tag across the bundles', () => {
    expect(tagCounts([
      { tags: ['docs', 'vue'] },
      { tags: ['docs'] }
    ])).toEqual([
      { tag: 'docs', count: 2 },
      { tag: 'vue', count: 1 }
    ])
  })

  it('sorts by count descending, then alphabetically', () => {
    const result = tagCounts([
      { tags: ['zebra', 'docs', 'ui'] },
      { tags: ['docs', 'ui'] },
      { tags: ['docs'] }
    ])
    expect(result.map(t => t.tag)).toEqual(['docs', 'ui', 'zebra'])
    expect(result.map(t => t.count)).toEqual([3, 2, 1])
  })

  it('breaks ties alphabetically rather than by first appearance', () => {
    expect(tagCounts([{ tags: ['vue', 'nuxt', 'api'] }]).map(t => t.tag))
      .toEqual(['api', 'nuxt', 'vue'])
  })

  it('returns nothing for bundles with no tags', () => {
    expect(tagCounts([{ tags: [] }, { tags: [] }])).toEqual([])
    expect(tagCounts([])).toEqual([])
  })
})
