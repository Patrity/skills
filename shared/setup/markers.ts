export const startMarker = (sourceId: string) => `<!-- skills:${sourceId} -->`
export const endMarker = (sourceId: string) => `<!-- /skills:${sourceId} -->`

const START = /^<!-- skills:([^\s>]+) -->$/
const END = /^<!-- \/skills:([^\s>]+) -->$/

export interface MarkerBlock {
  sourceId: string
  /** Line index of the start marker. */
  start: number
  /** Line index of the end marker. */
  end: number
  /** Text between the markers, trimmed. */
  content: string
}

export function findMarkerBlocks(md: string): MarkerBlock[] {
  const lines = md.split('\n')
  const blocks: MarkerBlock[] = []
  for (let i = 0; i < lines.length; i++) {
    const open = START.exec(lines[i]!)
    if (!open) continue
    const id = open[1]!
    for (let j = i + 1; j < lines.length; j++) {
      const close = END.exec(lines[j]!)
      if (close && close[1] === id) {
        blocks.push({ sourceId: id, start: i, end: j, content: lines.slice(i + 1, j).join('\n').trim() })
        i = j
        break
      }
    }
  }
  return blocks
}

/** Remove marker blocks (and one following blank line) except those `keep` returns true for. */
export function stripMarkerBlocks(md: string, keep: (sourceId: string) => boolean = () => false): string {
  const lines = md.split('\n')
  const drop = new Set<number>()
  for (const block of findMarkerBlocks(md)) {
    if (keep(block.sourceId)) continue
    for (let i = block.start; i <= block.end; i++) drop.add(i)
    if (lines[block.end + 1] === '') drop.add(block.end + 1)
  }
  const result = lines.filter((_, i) => !drop.has(i)).join('\n')
  // Preserve trailing newline if original had one
  if (md.endsWith('\n') && !result.endsWith('\n')) {
    return result + '\n'
  }
  return result
}
