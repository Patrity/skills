import { cancel, confirm, groupMultiselect, isCancel, note, select, text } from '@clack/prompts'
import type { BaseSchema, Profile } from '../../shared/types/setup'
import type { SkillSummary } from '../../shared/types/skills'
import { activeAxes } from './contributions'
import type { SetupPlan } from './plan'
import { groupByTag } from './wizard'

/** Unwrap a clack result; a cancel (Ctrl-C) exits cleanly. */
function bail<T>(value: T | symbol): T {
  if (isCancel(value)) {
    cancel('Cancelled.')
    process.exit(0)
  }
  return value as T
}

export async function askAxes(schema: BaseSchema, answers: Record<string, string>): Promise<Record<string, string>> {
  const out = { ...answers }
  // Re-evaluate after every answer so follow-ups appear as soon as their condition holds.
  for (let i = 0; i < schema.axes.length; i++) {
    const axis = activeAxes(schema, out)[i]
    if (!axis) break
    if (axis.options) {
      out[axis.id] = bail(await select({ message: axis.question, initialValue: out[axis.id] ?? axis.default, options: axis.options.map(o => ({ value: o.id, label: o.label, hint: o.description })) }))
    } else if (axis.input) {
      out[axis.id] = bail(await text({ message: axis.question, placeholder: axis.input.placeholder, initialValue: out[axis.id] ?? axis.input.default })) || axis.input.default
    }
  }
  return out
}

export async function askBundles(skills: SkillSummary[], preselected: string[], profiles: Profile[]): Promise<{ bundles: string[], profile?: Profile }> {
  let profile: Profile | undefined
  if (profiles.length) {
    const picked = bail(await select({ message: 'Start from a profile?', initialValue: 'none', options: [{ value: 'none', label: 'No profile — pick bundles myself' }, ...profiles.map(p => ({ value: p.name, label: p.name, hint: p.description }))] }))
    profile = profiles.find(p => p.name === picked)
  }
  const initial = [...new Set([...preselected, ...(profile?.bundles ?? [])])]
  const options = Object.fromEntries(Object.entries(groupByTag(skills)).map(([tag, list]) => [tag, list.map(s => ({ value: s.slug, label: s.name, hint: s.description }))]))
  const chosen = bail(await groupMultiselect({ message: 'Which bundles?', options, initialValues: initial, required: false }))
  return { bundles: chosen, profile }
}

/**
 * The plan in a dozen lines: counts, then every path the run will not write and why — a skipped
 * conflict or a protected edit is the whole reason to read this, so it is named, not just counted.
 */
export function summarize(plan: SetupPlan, overwrite: ReadonlySet<string> = new Set()): string {
  const count = (a: string) => plan.files.filter(f => f.action === a).length
  const paths = (a: string) => plan.files.filter(f => f.action === a).map(f => f.path)
  const lines = [
    `create ${count('create')} · update ${count('update')} · unchanged ${count('unchanged')} · conflicts ${count('conflict')} · protected ${count('protected')}`,
    ...paths('conflict').map(p => `conflict: ${p} (${overwrite.has(p) ? 'overwriting' : 'kept yours'})`),
    ...paths('protected').map(p => `protected: ${p} (kept your edit)`),
    ...(plan.removals.length ? [`remove ${plan.removals.length}: ${plan.removals.join(', ')}`] : []),
    `CLAUDE.md: ${plan.claudeMd.changed ? 'updated' : 'unchanged'}${plan.claudeMd.handEdited.length ? ` (hand-edited kept: ${plan.claudeMd.handEdited.join(', ')})` : ''}`,
    `settings.json: ${plan.settings ? (plan.settings.changed ? 'merged' : 'unchanged') : '—'} · settings.local.json: ${plan.settingsLocal ? (plan.settingsLocal.changed ? 'merged' : 'unchanged') : '—'}`,
    ...plan.warnings.map(w => `⚠ ${w}`)
  ]
  return lines.join('\n')
}

export async function confirmPlan(plan: SetupPlan, overwrite: ReadonlySet<string> = new Set()): Promise<boolean> {
  note(summarize(plan, overwrite), 'Plan')
  return bail(await confirm({ message: 'Apply?', initialValue: true }))
}

export async function resolveConflicts(plan: SetupPlan): Promise<Set<string>> {
  const overwrite = new Set<string>()
  for (const op of plan.files.filter(f => f.action === 'conflict')) {
    const choice = bail(await select({ message: `${op.path} exists and is not managed.`, options: [{ value: 'skip', label: 'Skip (keep mine)' }, { value: 'overwrite', label: 'Overwrite with the bundle version' }] }))
    if (choice === 'overwrite') overwrite.add(op.path)
  }
  return overwrite
}
