import type { SectionDef } from '../types/setup'
import { CANONICAL_SECTIONS, sectionIdForHeading } from './sections'
import { endMarker, startMarker, stripMarkerBlocks } from './markers'

export interface Contribution {
  sourceId: string
  sectionId: string
  markdown: string
}

interface DocSection {
  /** Canonical id when the heading is canonical, else null (user section). */
  id: string | null
  heading: string | null // the `## …` line, null for the preamble
  lines: string[]
}

function parseDoc(md: string): DocSection[] {
  const out: DocSection[] = [{ id: 'intro', heading: null, lines: [] }]
  for (const line of md.split('\n')) {
    const h2 = /^##\s+(.+?)\s*$/.exec(line)
    if (h2) {
      out.push({ id: sectionIdForHeading(h2[1]!), heading: line, lines: [] })
    } else {
      out[out.length - 1]!.lines.push(line)
    }
  }
  return out
}

function trimBlank(lines: string[]): string[] {
  let start = 0
  let end = lines.length
  while (start < end && lines[start]!.trim() === '') start++
  while (end > start && lines[end - 1]!.trim() === '') end--
  return lines.slice(start, end)
}

function renderBlock(c: Contribution): string[] {
  return [startMarker(c.sourceId), c.markdown.trim(), endMarker(c.sourceId), '']
}

/**
 * Compose CLAUDE.md: every previous marker block is removed, all other text is kept, and the
 * contributions are written inside marker blocks under their canonical section — reusing a
 * heading the document already has, or creating it in canonical order.
 */
export function composeClaudeMd(existing: string | null, opts: {
  title: string
  intro?: string
  sections?: SectionDef[]
  contributions: Contribution[]
}): string {
  const sections = opts.sections ?? CANONICAL_SECTIONS
  const order = sections.map(s => s.id)
  const base = existing ? stripMarkerBlocks(existing) : `# ${opts.title}\n${opts.intro ? `\n${opts.intro}\n` : ''}`
  const doc = parseDoc(base)

  const bySection = new Map<string, Contribution[]>()
  for (const c of opts.contributions) {
    if (!bySection.has(c.sectionId)) bySection.set(c.sectionId, [])
    bySection.get(c.sectionId)!.push(c)
  }

  // Append blocks into existing canonical sections; create the missing ones in canonical order.
  for (const id of order) {
    if (id === 'intro') continue
    const contribs = bySection.get(id)
    let section = doc.find(s => s.id === id)
    if (!contribs?.length) {
      // A canonical section we created earlier and that is now empty disappears.
      if (section && trimBlank(section.lines).length === 0) doc.splice(doc.indexOf(section), 1)
      continue
    }
    if (!section) {
      const title = sections.find(s => s.id === id)!.title
      section = { id, heading: `## ${title}`, lines: [] }
      // Insert after the last canonical section that precedes this id in canonical order.
      let insertAt = doc.length
      for (let i = doc.length - 1; i >= 1; i--) {
        const sid = doc[i]!.id
        if (sid && order.indexOf(sid) < order.indexOf(id)) {
          insertAt = i + 1
          break
        }
      }
      if (insertAt === doc.length) {
        // No canonical predecessor: right after the preamble, unless user sections exist before
        // any canonical one — then after the last user section that precedes the first canonical.
        const firstCanonical = doc.findIndex((s, i) => i > 0 && s.id && order.indexOf(s.id) > order.indexOf(id))
        insertAt = firstCanonical === -1 ? doc.length : firstCanonical
      }
      doc.splice(insertAt, 0, section)
    }
    const body = trimBlank(section.lines)
    section.lines = [...(body.length ? [...body, ''] : []), ...contribs.flatMap(renderBlock)]
  }

  const out: string[] = []
  doc.forEach((s, i) => {
    if (s.heading) {
      out.push(s.heading)
      // Add blank line after heading only if it's canonical, or if original had blank space after
      const isCanonical = s.id && s.id !== 'intro'
      const hadBlankLineAfterHeading = s.lines[0] === ''
      if (isCanonical || hadBlankLineAfterHeading) {
        out.push('')
      }
    }
    // Don't trim blank lines for intro or user sections; preserve their structure
    const shouldTrimBlank = s.id && s.id !== 'intro'
    const body = shouldTrimBlank ? trimBlank(s.lines) : s.lines
    if (body.length) out.push(...body, '')
    else if (i === 0 && !s.heading) { /* empty preamble */ }
  })
  return `${out.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd()}\n`
}
