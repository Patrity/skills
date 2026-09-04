import type { BaseAxis, BaseSchema, CliManifest, SectionDef } from '../../shared/types/setup'
import { splitSnippet } from '../../shared/setup/sections'
import { renderPlaceholders, type PlaceholderVars } from '../../shared/setup/placeholders'
import type { Contribution } from '../../shared/setup/render'
import type { BundleFiles } from './registry'

const decoder = new TextDecoder()

/** Axes the wizard actually asks: every axis whose `when` follow-up condition is satisfied. */
export function activeAxes(schema: BaseSchema, answers: Record<string, string>): BaseAxis[] {
  return schema.axes.filter(a => !a.when || answers[a.when.axis] === a.when.option)
}

interface Collector {
  vars: Record<string, string>
  /** The base's section list; canonical when the manifest has no base. */
  sections?: SectionDef[]
  out: Contribution[]
  warnings: string[]
}

function render(ctx: Collector, text: string, label: string): string {
  const { text: out, unknown } = renderPlaceholders(text, ctx.vars as PlaceholderVars)
  for (const key of unknown) ctx.warnings.push(`${label}: unknown placeholder {{${key}}}`)
  return out
}

function addSnippet(ctx: Collector, md: string, sourceId: string, label: string): void {
  const { byId, errors } = splitSnippet(md, ctx.sections)
  for (const e of errors) ctx.warnings.push(`${label}: ${e}`)
  for (const [sectionId, markdown] of Object.entries(byId)) {
    ctx.out.push({ sourceId, sectionId, markdown: render(ctx, markdown, label) })
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
  const base = input.manifest.base
  const ctx: Collector = { vars: input.vars, sections: base?.sections, out: [], warnings: [] }
  if (base) {
    for (const name of Object.keys(base.always).sort()) {
      addSnippet(ctx, base.always[name]!, `base:always/${name.replace(/\.md$/, '')}`, `base/always/${name}`)
    }
    for (const axis of activeAxes(base, input.answers)) {
      const option = axis.options?.find(o => o.id === input.answers[axis.id])
      if (!option?.fragment) continue
      const md = base.fragments[option.fragment]
      if (md === undefined) {
        ctx.warnings.push(`axis ${axis.id}: fragment ${option.fragment} missing from manifest`)
        continue
      }
      addSnippet(ctx, md, `base:${axis.id}=${option.id}`, `base/fragments/${option.fragment}`)
    }
  }
  for (const slug of [...input.bundles].sort()) {
    const files = input.bundleFiles[slug] ?? {}
    const key = Object.keys(files).find(p => p.toLowerCase() === 'claude.md')
    if (!key) continue
    addSnippet(ctx, decoder.decode(files[key]!), `bundle:${slug}`, `bundle:${slug} CLAUDE.md`)
  }
  return { contributions: ctx.out, warnings: ctx.warnings }
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
