import { describe, expect, it } from 'vitest'
import { CANONICAL_SECTIONS, DEFAULT_SECTION_ID, splitSnippet } from '../../shared/setup/sections'

describe('CANONICAL_SECTIONS', () => {
  it('has the 13 sections in canonical order', () => {
    expect(CANONICAL_SECTIONS.map(s => s.id)).toEqual([
      'intro', 'read-first', 'stack', 'commands', 'workflow', 'testing', 'docs', 'git', 'deploy',
      'constraints', 'memory', 'skills-and-rules', 'self-improvement'
    ])
    expect(CANONICAL_SECTIONS.find(s => s.id === 'constraints')!.title).toBe('Constraints that bit before')
  })
})

describe('splitSnippet', () => {
  it('routes content under canonical headings to their section ids', () => {
    const md = `## Commands\n- \`{{pm}} typecheck\` often\n\n## Constraints that bit before\n- Shiki OOMs builds\n`
    const r = splitSnippet(md)
    expect(r.errors).toEqual([])
    expect(r.byId).toEqual({
      commands: '- `{{pm}} typecheck` often',
      constraints: '- Shiki OOMs builds'
    })
  })

  it('accepts `## @id` headings', () => {
    const r = splitSnippet('## @skills-and-rules\n- invoke nuxt-docs\n')
    expect(r.byId['skills-and-rules']).toBe('- invoke nuxt-docs')
  })

  it('puts content before any heading into skills-and-rules', () => {
    const r = splitSnippet('- Always pnpm\n\n## Git\n- no trailers\n')
    expect(r.byId[DEFAULT_SECTION_ID]).toBe('- Always pnpm')
    expect(r.byId.git).toBe('- no trailers')
  })

  it('rejects unknown headings and reports them', () => {
    const r = splitSnippet('## Random Stuff\n- x\n## Commands\n- y\n')
    expect(r.errors).toEqual(['unknown section heading "Random Stuff" (use a canonical title or ## @id)'])
    expect(r.byId.commands).toBe('- y')
    expect(r.byId['Random Stuff']).toBeUndefined()
  })

  it('merges repeated headings and ignores deeper headings', () => {
    const r = splitSnippet('## Commands\n- a\n### sub\n- b\n## Commands\n- c\n')
    expect(r.byId.commands).toBe('- a\n### sub\n- b\n\n- c')
  })

  it('returns nothing for an empty snippet', () => {
    expect(splitSnippet('   \n')).toEqual({ byId: {}, errors: [] })
  })
})
