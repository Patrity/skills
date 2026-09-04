export const PLACEHOLDERS = ['pm', 'pmx', 'appDir', 'pkgDir', 'projectName'] as const
export type PlaceholderVars = Record<(typeof PLACEHOLDERS)[number], string>

const PMX: Record<string, string> = { pnpm: 'pnpx', npm: 'npx', yarn: 'yarn dlx', bun: 'bunx' }

/** The package root that holds `appDir`, as a prefix: `apps/web/app` → `apps/web/`. */
function packageDir(appDir: string): string {
  const trimmed = appDir.replace(/\/+$/, '')
  const cut = trimmed.lastIndexOf('/')
  return cut > 0 ? trimmed.slice(0, cut + 1) : ''
}

/**
 * Derive the placeholder variables from wizard answers. Unknown pm falls back to pnpm.
 *
 * `appDir` is the app's srcDir relative to the project root (`app`, or `apps/web/app` in a
 * monorepo). `pkgDir` is the package root that contains it, as a prefix relative to the project
 * root — `apps/web/` for that monorepo, and the empty string for a single-app layout. It is always
 * written immediately before a path, so a root-relative glob reads `{{pkgDir}}server/**` and
 * renders correctly under either layout.
 */
export function placeholderVars(answers: Record<string, string>, projectName: string): PlaceholderVars {
  const pm = answers.pm && PMX[answers.pm] ? answers.pm : 'pnpm'
  const appDir = answers.layout === 'monorepo' ? (answers.appDir || 'apps/web/app') : 'app'
  const pkgDir = answers.layout === 'monorepo' ? packageDir(appDir) : ''
  return { pm, pmx: PMX[pm]!, appDir, pkgDir, projectName }
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
