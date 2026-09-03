export const MAX_FILE_BYTES = 1024 * 1024

/** Drop `cache/` dirs (doc-fetcher skills) and any dot-segment (.gitignore, .DS_Store, .hidden/). */
export function isExcludedPath(relPath: string): boolean {
  return relPath.split('/').some(seg => seg === 'cache' || seg.startsWith('.'))
}
