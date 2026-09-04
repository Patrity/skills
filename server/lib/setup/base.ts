import { parse as parseYaml } from 'yaml'
import { z } from 'zod'
import type { BaseAxis, BaseSchema, SectionDef } from '../../../shared/types/setup'
import { CANONICAL_SECTIONS, splitSnippet } from '../../../shared/setup/sections'

const decoder = new TextDecoder()

const optionSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9-]*$/),
  label: z.string().min(1),
  description: z.string().optional(),
  fragment: z.string().regex(/^[a-z0-9-]+\/[a-z0-9-]+\.md$/).optional(),
  selects: z.array(z.string()).optional(),
  scaffolds: z.array(z.object({ template: z.string(), to: z.string().min(1), mode: z.enum(['create', 'append']).optional() })).optional()
})

const axisSchema = z.object({
  id: z.string().regex(/^[a-z][a-zA-Z0-9]*$/),
  question: z.string().min(1),
  description: z.string().optional(),
  when: z.object({ axis: z.string(), option: z.string() }).optional(),
  options: z.array(optionSchema).min(1).optional(),
  default: z.string().optional(),
  input: z.object({ placeholder: z.string(), default: z.string() }).optional()
})

const questionsSchema = z.object({ version: z.number().int().positive(), axes: z.array(axisSchema).min(1) })
const sectionsSchema = z.object({ sections: z.array(z.object({ id: z.string(), title: z.string() })) })

function text(files: Record<string, Uint8Array>, key: string): string | undefined {
  const bytes = files[key]
  return bytes ? decoder.decode(bytes) : undefined
}

function yamlOrError(src: string, label: string, errors: string[]): unknown {
  try {
    return parseYaml(src)
  } catch (err) {
    errors.push(`${label}: invalid YAML: ${(err as Error).message.split('\n')[0]}`)
    return undefined
  }
}

function collect(files: Record<string, Uint8Array>, dir: string, errors: string[], validateSections: boolean): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [path, bytes] of Object.entries(files)) {
    if (!path.startsWith(`${dir}/`) || !path.endsWith('.md')) continue
    const md = decoder.decode(bytes)
    if (validateSections) {
      for (const e of splitSnippet(md).errors) errors.push(`${path}: ${e}`)
    }
    out[path.slice(dir.length + 1)] = md
  }
  return out
}

export function parseBaseSchema(files: Record<string, Uint8Array>): { schema: BaseSchema | null, errors: string[] } {
  const errors: string[] = []
  const questionsSrc = text(files, 'questions.yaml')
  const sectionsSrc = text(files, 'sections.yaml')
  if (questionsSrc === undefined) errors.push('base/questions.yaml is missing')
  if (sectionsSrc === undefined) errors.push('base/sections.yaml is missing')
  if (errors.length) return { schema: null, errors }

  let sections: SectionDef[] = CANONICAL_SECTIONS
  const sectionsRaw = yamlOrError(sectionsSrc!, 'sections.yaml', errors)
  if (sectionsRaw !== undefined) {
    const parsed = sectionsSchema.safeParse(sectionsRaw)
    if (!parsed.success) {
      errors.push('sections.yaml: expected { sections: [{ id, title }] }')
    } else {
      const ids = parsed.data.sections.map(s => s.id)
      if (JSON.stringify(ids) !== JSON.stringify(CANONICAL_SECTIONS.map(s => s.id))) {
        errors.push('sections.yaml: section ids must be exactly the canonical list in order')
      } else {
        sections = parsed.data.sections
      }
    }
  }

  const fragments = collect(files, 'fragments', errors, true)
  const always = collect(files, 'always', errors, true)
  const templates = collect(files, 'templates', errors, false)

  let axes: BaseAxis[] = []
  let version = 0
  const questionsRaw = yamlOrError(questionsSrc!, 'questions.yaml', errors)
  if (questionsRaw !== undefined) {
    const parsed = questionsSchema.safeParse(questionsRaw)
    if (!parsed.success) {
      for (const issue of parsed.error.issues) errors.push(`questions.yaml: ${issue.path.join('.')}: ${issue.message}`)
    } else {
      version = parsed.data.version
      axes = parsed.data.axes as BaseAxis[]
      const seen = new Set<string>()
      axes.forEach((axis, index) => {
        const tag = `axis "${axis.id}"`
        if (seen.has(axis.id)) errors.push(`${tag}: duplicate id`)
        seen.add(axis.id)
        const hasOptions = !!axis.options?.length
        const hasInput = !!axis.input
        if (hasOptions === hasInput) errors.push(`${tag}: needs either options or input`)
        if (hasOptions) {
          if (!axis.default || !axis.options!.some(o => o.id === axis.default)) {
            errors.push(`${tag}: default "${axis.default ?? ''}" is not one of its options`)
          }
          for (const option of axis.options!) {
            if (option.fragment && !(option.fragment in fragments)) {
              errors.push(`${tag}: option "${option.id}" fragment "${option.fragment}" does not exist`)
            }
            for (const s of option.scaffolds ?? []) {
              if (!(s.template in templates)) {
                errors.push(`${tag}: option "${option.id}" scaffold template "${s.template}" does not exist`)
              }
            }
          }
        }
        if (axis.when) {
          const earlier = axes.slice(0, index).find(a => a.id === axis.when!.axis)
          if (!earlier) errors.push(`${tag}: when.axis "${axis.when.axis}" is not an earlier axis`)
          else if (!earlier.options?.some(o => o.id === axis.when!.option)) {
            errors.push(`${tag}: when.option "${axis.when.option}" is not an option of "${axis.when.axis}"`)
          }
        }
      })
    }
  }

  if (errors.length) return { schema: null, errors }
  return { schema: { version, sections, axes, fragments, always, templates }, errors }
}

export function validateBaseAgainstSlugs(schema: BaseSchema, slugs: string[]): string[] {
  const known = new Set(slugs)
  const errors: string[] = []
  for (const axis of schema.axes) {
    for (const option of axis.options ?? []) {
      for (const slug of option.selects ?? []) {
        if (!known.has(slug)) errors.push(`axis "${axis.id}": option "${option.id}" selects unknown bundle "${slug}"`)
      }
    }
  }
  return errors
}
