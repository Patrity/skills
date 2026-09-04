import type { Lockfile } from './lock'

export const GITIGNORE_START = '# >>> skills (managed by @patrity/skills; edit outside this block)'
export const GITIGNORE_END = '# <<< skills'

/** What the caller reports when `renderGitignoreBlock` refuses to touch an unterminated block. */
export const GITIGNORE_UNTERMINATED = '.gitignore has an unterminated skills block; left in place (close it with "# <<< skills")'

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
 * A start marker with no end marker after it — lost in a merge, or deleted by hand. The block's
 * extent is unknowable, so `renderGitignoreBlock` returns the file untouched and the caller warns.
 */
export function hasUnterminatedBlock(existing: string | null): boolean {
  if (existing === null) return false
  const lines = existing.split(/\r?\n/)
  const start = lines.indexOf(GITIGNORE_START)
  return start !== -1 && lines.indexOf(GITIGNORE_END, start) === -1
}

/**
 * Regenerate the managed block inside an existing .gitignore. Lines outside the block are never
 * touched; the block is appended after one blank line when absent and removed when it would be
 * empty. CRLF files stay CRLF. Returns null when there is no file and nothing to add, and the file
 * byte for byte whenever this tool has nothing to contribute to it.
 */
export function renderGitignoreBlock(existing: string | null, entries: string[]): string | null {
  const unique = [...new Set(entries)].sort()
  const lines = existing === null || existing === '' ? [] : existing.split(/\r?\n/)
  if (lines.length && lines[lines.length - 1] === '') lines.pop() // trailing newline
  const start = lines.indexOf(GITIGNORE_START)
  const end = start === -1 ? -1 : lines.indexOf(GITIGNORE_END, start)
  // Appending a second block after an orphan start marker would make the NEXT run read the orphan
  // as `start` and the new end marker as `end`, and silently delete every user line between them.
  if (start !== -1 && end === -1) return existing
  const block = unique.length ? [GITIGNORE_START, ...unique, GITIGNORE_END] : []
  // No block of ours and nothing to add: the file is entirely the user's, down to its line endings.
  if (!block.length && start === -1) return existing
  const eol = existing?.includes('\r\n') ? '\r\n' : '\n'
  let out: string[]
  if (start !== -1) {
    out = [...lines.slice(0, start), ...block, ...lines.slice(end + 1)]
    // Removing the block also removes the single blank line it was appended after — but only when
    // that leaves no double blank behind, i.e. the block sat at the end or was followed by a blank.
    if (!block.length && start > 0 && out[start - 1] === '' && (start >= out.length || out[start] === '')) out.splice(start - 1, 1)
  } else {
    out = lines.length ? [...lines, '', ...block] : block
  }
  if (!out.length) return existing === null ? null : ''
  return `${out.join(eol)}${eol}`
}

/**
 * The `.gitignore` a plan writes, and the warnings that go with it. Both `planFresh` (which always
 * starts from no file) and `buildPlan` (which starts from the project's own) go through here, so
 * an unterminated block is reported and left alone identically on either path.
 */
export function gitignoreFileFor(existing: string | null, entries: string[]): { file: { content: string, changed: boolean } | null, warnings: string[] } {
  const warnings = hasUnterminatedBlock(existing) ? [GITIGNORE_UNTERMINATED] : []
  const content = renderGitignoreBlock(existing, entries)
  return { file: content === null ? null : { content, changed: content !== (existing ?? '') }, warnings }
}
