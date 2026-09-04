import matter from 'gray-matter'
import { z } from 'zod'
import type { SkillFrontmatter } from '../../../shared/types/skills'

export const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/
export const ENV_NAME_RE = /^[A-Z][A-Z0-9_]*$/

const relativePath = z.string().min(1).refine(
  p => !p.startsWith('/') && !/(^|\/)\.\.(\/|$)/.test(p) && !/^[A-Za-z]:/.test(p) && !p.includes('\\'),
  { message: 'must be a project-relative path (no leading /, no .. segment)' }
)

const envVar = z.object({
  name: z.string().regex(ENV_NAME_RE, { message: 'must match ^[A-Z][A-Z0-9_]*$' }),
  description: z.string().min(1),
  required: z.boolean().optional(),
  example: z.string().optional()
})

// zod 4.5.4's `refine` only accepts `params?: string | $ZodCustomParams` — no function-of-value
// message — so the duplicate-name check uses `superRefine` with `ctx.addIssue({ path: [] })`
// instead: an empty path keeps the issue attached to this array, which (nested under
// `frontmatterSchema`'s `env` key) renders as `frontmatter.env` in parseFrontmatter below.
const envList = z.array(envVar).optional().superRefine((list, ctx) => {
  if (!list) return
  const seen = new Set<string>()
  for (const v of list) {
    if (seen.has(v.name)) {
      ctx.addIssue({ code: 'custom', message: `duplicate name ${v.name}`, path: [] })
      return
    }
    seen.add(v.name)
  }
})

export const frontmatterSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  tags: z.array(z.string().min(1)).min(1),
  author: z.string().min(1),
  authorUrl: z.url().optional(),
  requires: z.array(z.string().min(1)).optional(),
  dependsOn: z.array(z.string().regex(SLUG_RE)).optional(),
  suggests: z.array(z.string().regex(SLUG_RE)).optional(),
  gitignore: z.array(relativePath).optional(),
  env: envList
})

export interface FrontmatterResult {
  data: SkillFrontmatter | null
  errors: string[]
}

/**
 * The only place gray-matter is called. Two of its quirks are handled here:
 *
 * 1. Pass an (empty) options object so gray-matter skips its internal cache: cache
 *    hits return `Object.assign({}, cached)`, but gray-matter defines `.matter` (and
 *    `.language`/`.orig`/`.stringify`) as non-enumerable, so a second call with
 *    identical content would otherwise come back with `parsed.matter === undefined`.
 * 2. An empty string short-circuits before `.matter` is ever assigned, so `.matter`
 *    is `undefined` there too. Both cases collapse to `''`.
 *
 * gray-matter throws a `YAMLException` when the frontmatter block itself isn't valid
 * YAML. That must not take the whole snapshot down: on a parse error this returns the
 * source untouched (as if there were no frontmatter) with `yamlError` set so
 * `parseFrontmatter` can report it as a per-bundle validation error instead.
 */
export function splitFrontmatter(src: string): { matter: string, data: Record<string, unknown>, content: string, yamlError?: string } {
  try {
    const parsed = matter(src, {})
    return {
      matter: parsed.matter ?? '',
      data: (parsed.data ?? {}) as Record<string, unknown>,
      content: parsed.content ?? ''
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { matter: '', data: {}, content: src, yamlError: message.split('\n')[0] }
  }
}

export function parseFrontmatter(readme: string): FrontmatterResult {
  const parsed = splitFrontmatter(readme)
  if (parsed.yamlError) {
    return { data: null, errors: [`README.md frontmatter is not valid YAML: ${parsed.yamlError}`] }
  }
  if (!parsed.matter.trim()) {
    return { data: null, errors: ['README.md has no YAML frontmatter'] }
  }
  const result = frontmatterSchema.safeParse(parsed.data)
  if (!result.success) {
    const errors = result.error.issues.map((issue) => {
      const key = issue.path.join('.') || '(root)'
      const message = issue.code === 'invalid_type' && issue.message.toLowerCase().includes('undefined')
        ? 'required'
        : issue.message
      return `frontmatter.${key}: ${message}`
    })
    return { data: null, errors }
  }
  return { data: result.data, errors: [] }
}
