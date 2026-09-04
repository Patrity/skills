import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseBaseSchema, validateBaseAgainstSlugs } from '../../server/lib/setup/base'
import { parseProfiles } from '../../server/lib/setup/profiles'

function readTree(root: string): Record<string, Uint8Array> {
  const out: Record<string, Uint8Array> = {}
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const abs = join(dir, name)
      if (statSync(abs).isDirectory()) walk(abs)
      else out[relative(root, abs).split('\\').join('/')] = new Uint8Array(readFileSync(abs))
    }
  }
  walk(root)
  return out
}
const enc = (s: string) => new TextEncoder().encode(s)
const baseFiles = readTree(fileURLToPath(new URL('../fixtures/base', import.meta.url)))
const profileFiles = readTree(fileURLToPath(new URL('../fixtures/profiles', import.meta.url)))

describe('parseBaseSchema', () => {
  it('parses the fixture base', () => {
    const { schema, errors } = parseBaseSchema(baseFiles)
    expect(errors).toEqual([])
    expect(schema!.version).toBe(1)
    expect(schema!.sections.map(s => s.id)[3]).toBe('commands')
    expect(schema!.axes.map(a => a.id)).toEqual(['pm', 'layout', 'appDir'])
    expect(schema!.axes[2]!.when).toEqual({ axis: 'layout', option: 'monorepo' })
    expect(schema!.fragments['pm/pnpm.md']).toContain('Always `{{pm}}`')
    expect(schema!.always['self-improvement.md']).toContain('Update CLAUDE.md')
    expect(schema!.templates['browser-testing-project.md']).toContain('{{projectName}}')
  })

  it('reports a missing fragment, a bad default and an unknown follow-up axis', () => {
    const files = { ...baseFiles }
    files['questions.yaml'] = enc(`version: 1
axes:
  - id: pm
    question: Q
    default: bun
    options:
      - { id: pnpm, label: pnpm, fragment: pm/missing.md }
  - id: extra
    question: Q2
    when: { axis: nope, option: x }
    input: { placeholder: p, default: d }
`)
    const { schema, errors } = parseBaseSchema(files)
    expect(schema).toBeNull()
    expect(errors).toEqual(expect.arrayContaining([
      'axis "pm": default "bun" is not one of its options',
      'axis "pm": option "pnpm" fragment "pm/missing.md" does not exist',
      'axis "extra": when.axis "nope" is not an earlier axis'
    ]))
  })

  it('rejects a fragment with a non-canonical heading and a wrong section list', () => {
    const files = { ...baseFiles }
    files['fragments/pm/pnpm.md'] = enc('## Random\n- x\n')
    files['sections.yaml'] = enc('sections:\n  - { id: intro, title: "" }\n  - { id: commands, title: "Commands" }\n')
    const { errors } = parseBaseSchema(files)
    expect(errors).toEqual(expect.arrayContaining([
      'fragments/pm/pnpm.md: unknown section heading "Random" (use a canonical title or ## @id)',
      'sections.yaml: section ids must be exactly the canonical list in order'
    ]))
  })

  it('requires exactly one of options/input and rejects duplicate axis ids', () => {
    const files = { ...baseFiles }
    files['questions.yaml'] = enc('version: 1\naxes:\n  - { id: a, question: Q }\n  - { id: a, question: Q, input: { placeholder: p, default: d } }\n')
    const { errors } = parseBaseSchema(files)
    expect(errors).toEqual(expect.arrayContaining(['axis "a": needs either options or input', 'axis "a": duplicate id']))
  })

  it('reports missing files', () => {
    expect(parseBaseSchema({}).errors).toEqual(['base/questions.yaml is missing', 'base/sections.yaml is missing'])
  })

  it('validates scaffold templates', () => {
    const files = { ...baseFiles }
    files['questions.yaml'] = enc(`version: 1
axes:
  - id: browser
    question: Q
    default: cli
    options:
      - { id: cli, label: CLI, scaffolds: [{ template: browser-testing-project.md, to: ".claude/skills/{{projectName}}-browser-testing/SKILL.md" }] }
      - { id: broken, label: B, scaffolds: [{ template: nope.md, to: x.md, mode: append }] }
`)
    const { schema, errors } = parseBaseSchema(files)
    expect(schema).toBeNull()
    expect(errors).toEqual(['axis "browser": option "broken" scaffold template "nope.md" does not exist'])
  })
})

describe('validateBaseAgainstSlugs', () => {
  it('flags selects that reference unknown bundles', () => {
    const { schema } = parseBaseSchema(baseFiles)
    expect(validateBaseAgainstSlugs(schema!, ['demo'])).toEqual([])
    expect(validateBaseAgainstSlugs(schema!, ['other'])).toEqual(['axis "layout": option "monorepo" selects unknown bundle "demo"'])
  })
})

describe('parseProfiles', () => {
  const { schema } = parseBaseSchema(baseFiles)
  it('parses valid profiles', () => {
    const { profiles, errors } = parseProfiles(profileFiles, schema, ['demo'])
    expect(errors).toEqual([])
    expect(profiles).toEqual([{ name: 'demo', description: 'Fixture profile.', answers: { pm: 'pnpm', layout: 'single' }, bundles: ['demo'] }])
  })
  it('validates name, answers and bundles', () => {
    const files = { 'bad.yaml': enc('name: other\ndescription: d\nanswers: { pm: bun, nope: x }\nbundles: [ghost]\n') }
    const { profiles, errors } = parseProfiles(files, schema, ['demo'])
    expect(profiles).toEqual([])
    expect(errors).toEqual(expect.arrayContaining([
      'profiles/bad.yaml: name "other" must match the file name "bad"',
      'profiles/bad.yaml: answer pm="bun" is not an option',
      'profiles/bad.yaml: answer for unknown axis "nope"',
      'profiles/bad.yaml: unknown bundle "ghost"'
    ]))
  })
  it('accepts free text for input axes and reports YAML errors', () => {
    const ok = parseProfiles({ 'mono.yaml': enc('name: mono\ndescription: d\nanswers: { layout: monorepo, appDir: packages/site/app }\nbundles: []\n') }, schema, [])
    expect(ok.errors).toEqual([])
    const bad = parseProfiles({ 'x.yaml': enc('name: [unclosed') }, schema, [])
    expect(bad.errors[0]).toMatch(/^profiles\/x\.yaml: invalid YAML/)
  })
})
