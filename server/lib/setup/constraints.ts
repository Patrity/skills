import { splitFrontmatter } from '../skills/frontmatter'

const decoder = new TextDecoder()

/** `{{token}}` as the renderer sees it. Axis ids are `[a-z][a-zA-Z0-9]*`, so digits count. */
const PLACEHOLDER_RE = /\{\{\s*([A-Za-z][A-Za-z0-9]*)\s*\}\}/g

function isRule(path: string): boolean {
  return path.startsWith('rules/') && path.endsWith('.md')
}

/**
 * Every `rules/*.md` needs a non-empty `paths:` list: a rule with no globs never loads, and a
 * dead rule is indistinguishable from an obeyed one until an audit finds it.
 */
export function checkRulePaths(files: Record<string, Uint8Array>, pathPrefix = ''): string[] {
  const errors: string[] = []
  for (const [path, bytes] of Object.entries(files)) {
    if (!isRule(path)) continue
    const where = pathPrefix + path
    const { data, yamlError } = splitFrontmatter(decoder.decode(bytes))
    if (yamlError) {
      errors.push(`${where}: frontmatter is not valid YAML: ${yamlError}`)
      continue
    }
    const paths = data.paths
    if (!Array.isArray(paths) || paths.length === 0 || !paths.every(p => typeof p === 'string' && p.trim().length > 0)) {
      errors.push(`${where}: needs a non-empty \`paths:\` list in frontmatter — a rule with no globs never loads`)
    }
  }
  return errors
}

/**
 * Every `{{…}}` token in published text must be a placeholder the renderer knows: one of
 * `PLACEHOLDERS`, or the id of a text-input axis (whose answer becomes a variable of the same
 * name). Anything else ships to the consumer's project verbatim.
 */
export function checkPlaceholders(texts: Record<string, string>, known: Iterable<string>): string[] {
  const allowed = new Set(known)
  const errors: string[] = []
  for (const [path, text] of Object.entries(texts)) {
    const seen = new Set<string>()
    text.split('\n').forEach((line, i) => {
      for (const match of line.matchAll(PLACEHOLDER_RE)) {
        const token = match[1]!
        if (allowed.has(token) || seen.has(token)) continue
        seen.add(token)
        errors.push(`${path}:${i + 1}: unknown placeholder {{${token}}}`)
      }
    })
  }
  return errors
}

/** The bundle files whose placeholders are rendered on install. */
export function placeholderTexts(files: Record<string, Uint8Array>, pathPrefix = ''): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [path, bytes] of Object.entries(files)) {
    const isSkill = path.startsWith('skills/') && path.endsWith('.md')
    if (path === 'CLAUDE.md' || isRule(path) || isSkill) out[pathPrefix + path] = decoder.decode(bytes)
  }
  return out
}
