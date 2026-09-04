import type { EnvVar } from '../types/setup'

export const ENV_EXAMPLE_PATH = '.claude/.env.example'
const HEADER = '# Copy this file to .claude/.env and fill in the values. .claude/.env is gitignored; skills read it, never the repo root .env.'

/** The whole managed example file, or null when no installed bundle declares variables. */
export function renderEnvExample(bundles: { slug: string, env: EnvVar[] }[]): string | null {
  const groups = bundles.filter(b => b.env.length).sort((a, b) => a.slug.localeCompare(b.slug))
  if (!groups.length) return null
  const lines = [HEADER, '']
  for (const b of groups) {
    lines.push(`# skills: ${b.slug}`)
    for (const v of b.env) {
      lines.push(`# ${v.description}${v.required ? ' (required)' : ''}`)
      lines.push(`${v.name}=${v.example ?? ''}`)
    }
    lines.push('')
  }
  return lines.join('\n')
}
