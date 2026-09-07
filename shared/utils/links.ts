/**
 * Every off-site URL the shell and the pages link to, in one place.
 *
 * Personal profiles carry `rel="me"` wherever they are rendered (spec §6), so they are
 * kept apart from the project links in `SOCIALS`. Anything that is not a profile — the
 * blog, the RSS feed, npm, the repo — belongs in `LINKS` only.
 */
export const LINKS = {
  blog: 'https://www.techhivelabs.net/blog',
  lab: 'https://www.techhivelabs.net',
  rss: 'https://www.techhivelabs.net/rss.xml',
  x: 'https://x.com/Patrity',
  github: 'https://github.com/Patrity',
  bluesky: 'https://bsky.app/profile/patrity.com',
  linkedin: 'https://www.linkedin.com/in/tonycos/',
  repo: 'https://github.com/Patrity/skills',
  npm: 'https://www.npmjs.com/package/@patrity/skills'
} as const

export interface SocialLink {
  label: string
  href: string
  icon: string
}

/** Personal profiles. Rendered as `rel="me"` icon links; order is the render order. */
export const SOCIALS: readonly SocialLink[] = [
  { label: 'GitHub', href: LINKS.github, icon: 'i-simple-icons-github' },
  { label: 'X', href: LINKS.x, icon: 'i-simple-icons-x' },
  { label: 'Bluesky', href: LINKS.bluesky, icon: 'i-simple-icons-bluesky' },
  { label: 'LinkedIn', href: LINKS.linkedin, icon: 'i-simple-icons-linkedin' }
] as const

export interface NavItem {
  label: string
  to: string
  /** Leaves the site: rendered as a plain `<a>` with the ↗ glyph. */
  external?: boolean
}

/** Header and drawer navigation, in order. */
export const NAV: readonly NavItem[] = [
  { label: 'Skills', to: '/skills' },
  { label: 'Build', to: '/build' },
  { label: 'Docs', to: '/docs' },
  { label: 'Blog', to: LINKS.blog, external: true }
] as const

/**
 * Is `to` the nav item the visitor is on? Shared by the header and the drawer so the two
 * cannot drift.
 *
 * A prefix match, so `/docs/start-here` marks Docs rather than only an exact `/docs`. The
 * one special case is the bundle pages: they live at `/skill/<slug>`, singular, and the
 * list they came from is `/skills`, so nothing would be current on a bundle page without
 * naming that here.
 */
export function isNavCurrent(path: string, to: string): boolean {
  if (to === '/skills' && (path === '/skill' || path.startsWith('/skill/'))) return true
  return path === to || path.startsWith(`${to}/`)
}
