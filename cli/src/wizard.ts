import type { BaseSchema, Profile } from '../../shared/types/setup'
import type { SkillSummary } from '../../shared/types/skills'
import { activeAxes } from './contributions'

export function defaultAnswers(schema: BaseSchema): Record<string, string> {
  const out: Record<string, string> = {}
  for (const axis of schema.axes) {
    if (axis.options && axis.default) out[axis.id] = axis.default
    else if (axis.input) out[axis.id] = axis.input.default
  }
  return out
}

export function applyProfile(_schema: BaseSchema, profile: Profile | undefined, answers: Record<string, string>): Record<string, string> {
  return profile ? { ...answers, ...profile.answers } : { ...answers }
}

export function parseAnswerFlags(flags: string[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const flag of flags) {
    const m = /^([A-Za-z][A-Za-z0-9]*)=(.*)$/.exec(flag)
    if (!m) throw new Error(`--answer "${flag}": expected axis=option`)
    out[m[1]!] = m[2]!
  }
  return out
}

export function validateAnswers(schema: BaseSchema, answers: Record<string, string>): string[] {
  const errors: string[] = []
  for (const [id, value] of Object.entries(answers)) {
    const axis = schema.axes.find(a => a.id === id)
    if (!axis) {
      errors.push(`unknown axis "${id}"`)
      continue
    }
    if (axis.options && !axis.options.some(o => o.id === value)) errors.push(`${id}: "${value}" is not an option`)
  }
  return errors
}

export function preselectedBundles(schema: BaseSchema, answers: Record<string, string>, profile: Profile | undefined, skills: SkillSummary[]): string[] {
  const picked = new Set<string>(profile?.bundles ?? [])
  for (const axis of activeAxes(schema, answers)) {
    const option = axis.options?.find(o => o.id === answers[axis.id])
    for (const slug of option?.selects ?? []) picked.add(slug)
  }
  for (const slug of [...picked]) for (const s of skills.find(k => k.slug === slug)?.suggests ?? []) picked.add(s)
  return [...picked].filter(slug => skills.some(s => s.slug === slug)).sort()
}

export function resolveBundles(selected: string[], skills: SkillSummary[]): { bundles: string[], missing: string[] } {
  const known = new Map(skills.map(s => [s.slug, s]))
  const out = new Set<string>()
  const missing = new Set<string>()
  const visit = (slug: string) => {
    if (out.has(slug)) return
    const skill = known.get(slug)
    if (!skill) {
      missing.add(slug)
      return
    }
    out.add(slug)
    for (const dep of skill.dependsOn ?? []) visit(dep)
  }
  for (const slug of selected) visit(slug)
  return { bundles: [...out].sort(), missing: [...missing].sort() }
}

export function groupByTag(skills: SkillSummary[]): Record<string, SkillSummary[]> {
  const groups: Record<string, SkillSummary[]> = {}
  for (const skill of [...skills].sort((a, b) => a.slug.localeCompare(b.slug))) {
    const tag = skill.tags[0] ?? 'other'
    ;(groups[tag] ??= []).push(skill)
  }
  return groups
}
