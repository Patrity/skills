import { describe, expect, it } from 'vitest'
import { checkPlaceholders, checkRulePaths, placeholderTexts } from '../../server/lib/setup/constraints'
import { PLACEHOLDERS } from '../../shared/setup/placeholders'

const enc = (s: string) => new TextEncoder().encode(s)
const rule = (frontmatter: string) => enc(`---\n${frontmatter}\n---\n\n# A rule\n`)

describe('checkRulePaths', () => {
  it('accepts a rule with a non-empty paths list', () => {
    expect(checkRulePaths({ 'rules/ok.md': rule('paths:\n  - "{{pkgDir}}server/**/*.ts"') })).toEqual([])
  })

  it('rejects a rule with no paths, an empty list, or a non-list', () => {
    const files = {
      'rules/none.md': rule('description: no globs'),
      'rules/empty.md': rule('paths: []'),
      'rules/scalar.md': rule('paths: "server/**"'),
      'rules/blank.md': rule('paths:\n  - "  "')
    }
    expect(checkRulePaths(files, 'skills/demo/').map(e => e.split(':')[0])).toEqual([
      'skills/demo/rules/none.md',
      'skills/demo/rules/empty.md',
      'skills/demo/rules/scalar.md',
      'skills/demo/rules/blank.md'
    ])
    expect(checkRulePaths(files)[0]).toContain('non-empty `paths:` list')
  })

  it('reports frontmatter that is not valid YAML', () => {
    const errors = checkRulePaths({ 'rules/bad.md': enc('---\npaths:\n  - {{appDir}}/**\n---\n') })
    expect(errors).toHaveLength(1)
    expect(errors[0]).toContain('not valid YAML')
  })

  it('ignores everything that is not a rule file', () => {
    expect(checkRulePaths({
      'CLAUDE.md': enc('## Stack\n- no frontmatter here\n'),
      'skills/x/SKILL.md': enc('---\nname: x\n---\n'),
      'rules/notes.txt': enc('paths missing')
    })).toEqual([])
  })
})

describe('checkPlaceholders', () => {
  const known = [...PLACEHOLDERS, 'appDir']

  it('accepts every known placeholder', () => {
    const texts = { 'skills/demo/CLAUDE.md': '- run {{pm}} / {{ pmx }} in {{appDir}} under {{pkgDir}}server for {{projectName}}' }
    expect(checkPlaceholders(texts, known)).toEqual([])
  })

  it('accepts a text-input axis id and rejects a token no axis declares', () => {
    expect(checkPlaceholders({ 'base/fragments/a.md': '{{appDir}} {{dbUrl}}' }, [...PLACEHOLDERS, 'dbUrl'])).toEqual([])
    expect(checkPlaceholders({ 'base/fragments/a.md': '{{dbUrl}}' }, PLACEHOLDERS)).toEqual([
      'base/fragments/a.md:1: unknown placeholder {{dbUrl}}'
    ])
  })

  it('reports the line and each unknown token once per file', () => {
    const texts = { 'skills/demo/rules/x.md': 'ok {{pm}}\nbad {{nope}}\nbad {{nope}} again {{alsoNope}}' }
    expect(checkPlaceholders(texts, known)).toEqual([
      'skills/demo/rules/x.md:2: unknown placeholder {{nope}}',
      'skills/demo/rules/x.md:3: unknown placeholder {{alsoNope}}'
    ])
  })
})

describe('placeholderTexts', () => {
  it('picks the files whose placeholders are rendered on install', () => {
    const files = {
      'CLAUDE.md': enc('a'),
      'README.md': enc('b'),
      'rules/one.md': enc('c'),
      'skills/x/SKILL.md': enc('d'),
      'skills/x/fetch.py': enc('e'),
      'hooks/lint.sh': enc('f')
    }
    expect(Object.keys(placeholderTexts(files, 'skills/demo/'))).toEqual([
      'skills/demo/CLAUDE.md',
      'skills/demo/rules/one.md',
      'skills/demo/skills/x/SKILL.md'
    ])
  })
})
