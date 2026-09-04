import { describe, expect, it } from 'vitest'
import type { SectionDef } from '../../shared/types/setup'
import { endMarker, findMarkerBlocks, startMarker, stripMarkerBlocks } from '../../shared/setup/markers'
import { placeholderVars, renderPlaceholders } from '../../shared/setup/placeholders'
import { composeClaudeMd } from '../../shared/setup/render'

describe('markers', () => {
  const doc = `# X\n\n## Commands\n${startMarker('base:pm=pnpm')}\n- pnpm\n${endMarker('base:pm=pnpm')}\nkeep me\n${startMarker('bundle:nuxt')}\n- nuxt\n${endMarker('bundle:nuxt')}\n`
  it('finds blocks with their source ids and content', () => {
    const blocks = findMarkerBlocks(doc)
    expect(blocks.map(b => [b.sourceId, b.content])).toEqual([['base:pm=pnpm', '- pnpm'], ['bundle:nuxt', '- nuxt']])
  })
  it('strips blocks but keeps user text', () => {
    expect(stripMarkerBlocks(doc)).toBe('# X\n\n## Commands\nkeep me\n')
  })
  it('can keep selected sources', () => {
    expect(stripMarkerBlocks(doc, id => id === 'bundle:nuxt')).toContain('- nuxt')
    expect(stripMarkerBlocks(doc, id => id === 'bundle:nuxt')).not.toContain('- pnpm')
  })
  it('handles CRLF line endings correctly', () => {
    const crlfDoc = doc.replace(/\n/g, '\r\n')
    const blocks = findMarkerBlocks(crlfDoc)
    expect(blocks.map(b => b.sourceId)).toEqual(['base:pm=pnpm', 'bundle:nuxt'])
    expect(stripMarkerBlocks(crlfDoc)).toContain('keep me')
  })
})

describe('placeholders', () => {
  it('derives vars from answers', () => {
    expect(placeholderVars({ pm: 'pnpm', layout: 'single' }, 'my-app')).toEqual({ pm: 'pnpm', pmx: 'pnpx', appDir: 'app', projectName: 'my-app' })
    expect(placeholderVars({ pm: 'npm', layout: 'monorepo', appDir: 'apps/web/app' }, 'x').appDir).toBe('apps/web/app')
    expect(placeholderVars({ pm: 'bun' }, 'x').pmx).toBe('bunx')
    expect(placeholderVars({ pm: 'yarn' }, 'x').pmx).toBe('yarn dlx')
  })
  it('renders known placeholders and reports unknown ones', () => {
    const r = renderPlaceholders('run {{pm}} dev in {{appDir}}; {{nope}}', placeholderVars({ pm: 'pnpm' }, 'p'))
    expect(r.text).toBe('run pnpm dev in app; {{nope}}')
    expect(r.unknown).toEqual(['nope'])
  })
})

describe('composeClaudeMd', () => {
  const contributions = [
    { sourceId: 'base:always/self-improvement', sectionId: 'self-improvement', markdown: '- improve' },
    { sourceId: 'base:pm=pnpm', sectionId: 'commands', markdown: '- always pnpm' },
    { sourceId: 'bundle:nuxt', sectionId: 'commands', markdown: '- pnpm typecheck' },
    { sourceId: 'bundle:nuxt', sectionId: 'skills-and-rules', markdown: '- invoke nuxt-docs' }
  ]

  it('creates a fresh document in canonical order with one block per source per section', () => {
    const out = composeClaudeMd(null, { title: 'My App', intro: 'A thing.', contributions })
    expect(out).toBe([
      '# My App', '', 'A thing.', '',
      '## Commands', '',
      startMarker('base:pm=pnpm'), '- always pnpm', endMarker('base:pm=pnpm'), '',
      startMarker('bundle:nuxt'), '- pnpm typecheck', endMarker('bundle:nuxt'), '',
      '## Skills and rules', '',
      startMarker('bundle:nuxt'), '- invoke nuxt-docs', endMarker('bundle:nuxt'), '',
      '## Self-improvement', '',
      startMarker('base:always/self-improvement'), '- improve', endMarker('base:always/self-improvement'), ''
    ].join('\n'))
  })

  it('reuses an existing user heading and preserves user text before the blocks', () => {
    const existing = '# Mine\n\nIntro kept.\n\n## Commands\n- my own command\n\n## Notes\n- user section stays\n'
    const out = composeClaudeMd(existing, { title: 'Mine', contributions })
    expect(out).toContain('Intro kept.')
    expect(out.match(/## Commands/g)).toHaveLength(1)
    expect(out.indexOf('- my own command')).toBeLessThan(out.indexOf(startMarker('base:pm=pnpm')))
    expect(out).toContain('## Notes\n- user section stays')
    // Skills and rules is inserted after Commands (canonical order) — before the user's Notes? No:
    // new canonical sections go after the last canonical section that precedes them; Notes is not
    // canonical, so Skills and rules lands after Commands' content and before Notes.
    expect(out.indexOf('## Skills and rules')).toBeGreaterThan(out.indexOf('## Commands'))
    expect(out.indexOf('## Skills and rules')).toBeLessThan(out.indexOf('## Notes'))
  })

  it('is idempotent: re-composing replaces blocks instead of duplicating them', () => {
    const once = composeClaudeMd(null, { title: 'T', contributions })
    const twice = composeClaudeMd(once, { title: 'T', contributions })
    expect(twice).toBe(once)
  })

  it('drops a source that is no longer contributed and removes the section it leaves empty', () => {
    const once = composeClaudeMd(null, { title: 'T', contributions })
    const without = composeClaudeMd(once, { title: 'T', contributions: contributions.filter(c => c.sourceId !== 'bundle:nuxt') })
    expect(without).not.toContain('bundle:nuxt')
    expect(without).not.toContain('## Skills and rules')
    expect(without).toContain('## Commands')
  })

  it('is idempotent with CRLF line endings', () => {
    const crlfContrib = { sourceId: 'test:crlf', sectionId: 'commands', markdown: '- crlf test' }
    const once = composeClaudeMd(null, { title: 'T', contributions: [crlfContrib] })
    const crlfVersion = once.replace(/\n/g, '\r\n')
    const twice = composeClaudeMd(crlfVersion, { title: 'T', contributions: [crlfContrib] })
    expect(twice).toBe(once)
    const markerCount = (twice.match(/<!-- skills:test:crlf -->/g) || []).length
    expect(markerCount).toBe(1)
  })

  it('respects custom sections when reusing headings', () => {
    const customSections: SectionDef[] = [
      { id: 'setup', title: 'Setup' },
      { id: 'usage', title: 'Usage Guide' }
    ]

    const existing = '# App\n\n## Setup\nUser content here.\n'
    const contribs = [{ sourceId: 'custom:setup', sectionId: 'setup', markdown: '- do setup' }]

    const composed = composeClaudeMd(existing, {
      title: 'App',
      sections: customSections,
      contributions: contribs
    })

    expect((composed.match(/## Setup/g) || []).length).toBe(1)
    expect(composed).toContain('User content here.')
    expect(composed).toContain('- do setup')
  })
})
