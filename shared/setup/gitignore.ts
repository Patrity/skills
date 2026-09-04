import type { Lockfile } from './lock'

export const GITIGNORE_START = '# >>> skills (managed by @patrity/skills; edit outside this block)'
export const GITIGNORE_END = '# <<< skills'

/** Everything the tool wants ignored for this plan: sorted, unique. */
export function gitignoreEntries(plan: { settingsLocal: unknown | null, lock: Lockfile }): string[] {
  const out = new Set<string>()
  if (plan.settingsLocal) out.add('.claude/settings.local.json')
  for (const b of Object.values(plan.lock.bundles)) {
    // One bundle reading .claude/.env is enough to keep the file out of git for the whole project.
    if (b.env?.length) out.add('.claude/.env')
    for (const e of b.gitignore ?? []) out.add(e)
  }
  return [...out].sort()
}

/**
 * Regenerate the managed block inside an existing .gitignore. Lines outside the block are never
 * touched; the block is appended after one blank line when absent and removed when it would be
 * empty. CRLF files stay CRLF. Returns null when there is no file and nothing to add.
 */
export function renderGitignoreBlock(existing: string | null, entries: string[]): string | null {
  const unique = [...new Set(entries)].sort()
  if (existing === null && unique.length === 0) return null
  const eol = existing?.includes('\r\n') ? '\r\n' : '\n'
  const lines = existing === null || existing === '' ? [] : existing.split(/\r?\n/)
  if (lines.length && lines[lines.length - 1] === '') lines.pop() // trailing newline
  const start = lines.indexOf(GITIGNORE_START)
  const end = start === -1 ? -1 : lines.indexOf(GITIGNORE_END, start)
  const block = unique.length ? [GITIGNORE_START, ...unique, GITIGNORE_END] : []
  let out: string[]
  if (start !== -1 && end !== -1) {
    out = [...lines.slice(0, start), ...block, ...lines.slice(end + 1)]
    // Removing the block also removes the single blank line it was appended after — but only when
    // that leaves no double blank behind, i.e. the block sat at the end or was followed by a blank.
    if (!block.length && start > 0 && out[start - 1] === '' && (start >= out.length || out[start] === '')) out.splice(start - 1, 1)
  } else if (block.length) {
    out = lines.length ? [...lines, '', ...block] : block
  } else {
    out = lines
  }
  if (!out.length) return existing === null ? null : ''
  return `${out.join(eol)}${eol}`
}
