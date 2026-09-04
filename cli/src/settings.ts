export * from '../../shared/setup/settings'

/**
 * CLI-only: the browser builder has no .gitignore to keep. Task 4 replaces this with the
 * bundle-declared gitignore entries; until then it stays here, byte-identical to what it was.
 */
export function ensureGitignoreLine(gitignore: string | null, line: string): string {
  const lines = (gitignore ?? '').split('\n')
  if (lines.some(l => l.trim() === line)) return gitignore!
  const base = gitignore ? (gitignore.endsWith('\n') ? gitignore : `${gitignore}\n`) : ''
  return `${base}${line}\n`
}
