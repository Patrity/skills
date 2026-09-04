export const PLACEHOLDERS = ['pm', 'pmx', 'appDir', 'projectName'] as const
export type PlaceholderVars = Record<(typeof PLACEHOLDERS)[number], string>

const PMX: Record<string, string> = { pnpm: 'pnpx', npm: 'npx', yarn: 'yarn dlx', bun: 'bunx' }

/** Derive the placeholder variables from wizard answers. Unknown pm falls back to pnpm. */
export function placeholderVars(answers: Record<string, string>, projectName: string): PlaceholderVars {
  const pm = answers.pm && PMX[answers.pm] ? answers.pm : 'pnpm'
  const appDir = answers.layout === 'monorepo' ? (answers.appDir || 'apps/web/app') : 'app'
  return { pm, pmx: PMX[pm]!, appDir, projectName }
}

export function renderPlaceholders(text: string, vars: PlaceholderVars): { text: string, unknown: string[] } {
  const unknown = new Set<string>()
  const out = text.replace(/\{\{\s*([A-Za-z]+)\s*\}\}/g, (whole, key: string) => {
    if (key in vars) return vars[key as keyof PlaceholderVars]
    unknown.add(key)
    return whole
  })
  return { text: out, unknown: [...unknown] }
}
