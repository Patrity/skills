import matter from 'gray-matter'
import { z } from 'zod'
import type { SkillFrontmatter } from '../../../shared/types/skills'

export const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/

export const frontmatterSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  tags: z.array(z.string().min(1)).min(1),
  author: z.string().min(1),
  authorUrl: z.url().optional(),
  requires: z.array(z.string().min(1)).optional()
})

export interface FrontmatterResult {
  data: SkillFrontmatter | null
  errors: string[]
}

export function parseFrontmatter(readme: string): FrontmatterResult {
  // Pass an (empty) options object so gray-matter skips its internal cache:
  // cache hits return `Object.assign({}, cached)`, but gray-matter defines
  // `.matter` (and `.language`/`.orig`/`.stringify`) as non-enumerable, so a
  // second call with identical content would otherwise come back with
  // `parsed.matter === undefined`. See gray-matter/index.js `matter()`.
  const parsed = matter(readme, {})
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
