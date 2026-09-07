/** Bundle-relative path safety: no absolute, no traversal, no empty/dot segments, no backslash/NUL. */
export function isSafeRelativePath(p: string): boolean {
  if (!p || p.includes('\\') || p.includes('\u0000')) return false
  const segments = p.split('/')
  return segments.every(seg => seg !== '' && seg !== '.' && seg !== '..')
}

/**
 * Is this path the bundle's own README, i.e. `README.md` at the bundle root?
 *
 * The same file `parseBundle` reads the frontmatter from, matched the same way (case
 * insensitive, root only). It is the one markdown file whose title the skill page already
 * renders as the page heading, so it is the one whose leading `# Title` is dropped rather
 * than demoted. A `README.md` inside a folder is somebody's chapter, not the bundle's.
 */
export function isBundleReadmePath(p: string): boolean {
  return p.toLowerCase() === 'readme.md'
}
