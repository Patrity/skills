import type { BaseAxis, BaseSchema, CliManifest } from '../../shared/types/setup'
import { splitSnippet } from '../../shared/setup/sections'
import { renderPlaceholders, type PlaceholderVars } from '../../shared/setup/placeholders'
import type { Contribution } from '../../shared/setup/render'
import type { BundleFiles } from './registry'

const decoder = new TextDecoder()

/** Axes the wizard actually asks: every axis whose `when` follow-up condition is satisfied. */
export function activeAxes(schema: BaseSchema, answers: Record<string, string>): BaseAxis[] {
  return schema.axes.filter(a => !a.when || answers[a.when.axis] === a.when.option)
}

function render(text: string, vars: Record<string, string>, label: string, warnings: string[]): string {
  const { text: out, unknown } = renderPlaceholders(text, vars as PlaceholderVars)
  for (const key of unknown) warnings.push(`${label}: unknown placeholder {{${key}}}`)
  return out
}

function addSnippet(md: string, sourceId: string, vars: Record<string, string>, label: string, out: Contribution[], warnings: string[]): void {
  const { byId, errors } = splitSnippet(md)
  for (const e of errors) warnings.push(`${label}: ${e}`)
  for (const [sectionId, markdown] of Object.entries(byId)) {
    out.push({ sourceId, sectionId, markdown: render(markdown, vars, label, warnings) })
  }
}

/** Ordered contributions: always fragments, then answered axis fragments (schema order), then bundles A→Z. */
export function contributionsFor(input: {
  manifest: CliManifest
  answers: Record<string, string>
  bundles: string[]
  bundleFiles: Record<string, BundleFiles>
  vars: PlaceholderVars & Record<string, string>
}): { contributions: Contribution[], warnings: string[] } {
  const out: Contribution[] = []
  const warnings: string[] = []
  const base = input.manifest.base
  if (base) {
    for (const name of Object.keys(base.always).sort()) {
      addSnippet(base.always[name]!, `base:always/${name.replace(/\.md$/, '')}`, input.vars, `base/always/${name}`, out, warnings)
    }
    for (const axis of activeAxes(base, input.answers)) {
      const option = axis.options?.find(o => o.id === input.answers[axis.id])
      if (!option?.fragment) continue
      const md = base.fragments[option.fragment]
      if (md === undefined) {
        warnings.push(`axis ${axis.id}: fragment ${option.fragment} missing from manifest`)
        continue
      }
      addSnippet(md, `base:${axis.id}=${option.id}`, input.vars, `base/fragments/${option.fragment}`, out, warnings)
    }
  }
  for (const slug of [...input.bundles].sort()) {
    const files = input.bundleFiles[slug] ?? {}
    const key = Object.keys(files).find(p => p.toLowerCase() === 'claude.md')
    if (!key) continue
    addSnippet(decoder.decode(files[key]!), `bundle:${slug}`, input.vars, `bundle:${slug} CLAUDE.md`, out, warnings)
  }
  return { contributions: out, warnings }
}

/** Files the chosen base options ask the wizard to scaffold into the project. */
export function scaffoldsFor(schema: BaseSchema, answers: Record<string, string>): { template: string, to: string, mode: 'create' | 'append' }[] {
  const out: { template: string, to: string, mode: 'create' | 'append' }[] = []
  for (const axis of activeAxes(schema, answers)) {
    const option = axis.options?.find(o => o.id === answers[axis.id])
    for (const s of option?.scaffolds ?? []) out.push({ template: s.template, to: s.to, mode: s.mode ?? 'create' })
  }
  return out
}
