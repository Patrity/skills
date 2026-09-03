import { docsNav, type DocEntry } from '~~/content/docs/nav'

// Docs ship with the build (they describe the app, not the bundles), so a static glob is right.
const sources = import.meta.glob('../../content/docs/*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>

export function getDoc(slug: string): { entry: DocEntry, source: string } | null {
  const entry = docsNav.find(d => d.slug === slug)
  if (!entry) return null
  const source = sources[`../../content/docs/${entry.file}`]
  return source === undefined ? null : { entry, source }
}
