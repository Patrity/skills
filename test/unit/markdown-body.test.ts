import { describe, expect, it } from 'vitest'
import { dropLeadingH1 } from '../../server/lib/skills/markdown-body'
import type { MarkdownBody } from '../../shared/types/skills'

function element(tag: string, text: string) {
  return { type: 'element' as const, tag, props: {}, children: [{ type: 'text' as const, value: text }] }
}

function body(...children: MarkdownBody['children']): MarkdownBody {
  return { type: 'root', children }
}

describe('dropLeadingH1', () => {
  it('removes a leading h1 and reports it', () => {
    const doc = body(element('h1', 'Nuxt'), element('p', 'One doc-fetching skill.'))
    expect(dropLeadingH1(doc)).toBe(true)
    expect(doc.children).toEqual([element('p', 'One doc-fetching skill.')])
  })

  it('leaves an h1 that is not the first node', () => {
    const doc = body(element('p', 'Intro'), element('h1', 'Later'))
    expect(dropLeadingH1(doc)).toBe(false)
    expect(doc.children).toHaveLength(2)
  })

  it('removes only the first of two leading h1s', () => {
    const doc = body(element('h1', 'One'), element('h1', 'Two'))
    expect(dropLeadingH1(doc)).toBe(true)
    expect(doc.children).toEqual([element('h1', 'Two')])
  })

  it('leaves a document that opens at h2 alone', () => {
    const doc = body(element('h2', 'Stack'), element('p', 'Nuxt 4.'))
    expect(dropLeadingH1(doc)).toBe(false)
    expect(doc.children).toHaveLength(2)
  })

  it('handles an empty body', () => {
    const doc = body()
    expect(dropLeadingH1(doc)).toBe(false)
    expect(doc.children).toEqual([])
  })

  it('ignores a leading text node', () => {
    const doc = body({ type: 'text', value: '\n' }, element('h1', 'Nuxt'))
    expect(dropLeadingH1(doc)).toBe(false)
    expect(doc.children).toHaveLength(2)
  })
})
