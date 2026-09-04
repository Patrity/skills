import type { SectionDef } from '../types/setup'

export const CANONICAL_SECTIONS: SectionDef[] = [
  { id: 'intro', title: '' },
  { id: 'read-first', title: 'Read first' },
  { id: 'stack', title: 'Stack' },
  { id: 'commands', title: 'Commands' },
  { id: 'workflow', title: 'Workflow' },
  { id: 'testing', title: 'Testing' },
  { id: 'docs', title: 'Docs' },
  { id: 'git', title: 'Git' },
  { id: 'deploy', title: 'Deploy' },
  { id: 'constraints', title: 'Constraints that bit before' },
  { id: 'memory', title: 'Memory' },
  { id: 'skills-and-rules', title: 'Skills and rules' },
  { id: 'self-improvement', title: 'Self-improvement' }
]

export const DEFAULT_SECTION_ID = 'skills-and-rules'

const H2 = /^##\s+(.+?)\s*$/

/** Resolve a `## Heading` line to a section id, or null when it is not canonical. */
export function sectionIdForHeading(heading: string, sections: SectionDef[] = CANONICAL_SECTIONS): string | null {
  const at = /^@([a-z-]+)$/.exec(heading)
  if (at) return sections.some(s => s.id === at[1]) ? at[1]! : null
  const byTitle = sections.find(s => s.title && s.title.toLowerCase() === heading.toLowerCase())
  return byTitle?.id ?? null
}

/**
 * Split a CLAUDE.md snippet (a base fragment or a bundle's CLAUDE.md) into per-section
 * markdown. Only `##` headings are section boundaries; deeper headings stay in the body.
 */
export function splitSnippet(md: string, sections: SectionDef[] = CANONICAL_SECTIONS): { byId: Record<string, string>, errors: string[] } {
  const byId: Record<string, string[]> = {}
  const errors: string[] = []
  let current: string | null = DEFAULT_SECTION_ID
  let buffer: string[] = []

  const flush = () => {
    const text = buffer.join('\n').trim()
    buffer = []
    if (!text || current === null) return
    byId[current] = byId[current] ? [...byId[current]!, text] : [text]
  }

  for (const line of md.split(/\r?\n/)) {
    const match = H2.exec(line)
    if (!match) {
      buffer.push(line)
      continue
    }
    flush()
    const id = sectionIdForHeading(match[1]!, sections)
    if (!id) {
      errors.push(`unknown section heading "${match[1]}" (use a canonical title or ## @id)`)
      current = null // swallow this section's content
    } else {
      current = id
    }
  }
  flush()

  return {
    byId: Object.fromEntries(Object.entries(byId).map(([id, parts]) => [id, parts.join('\n\n')])),
    errors
  }
}
