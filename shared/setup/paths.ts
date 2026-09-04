/**
 * `path.posix.normalize` for a relative path, with no Node dependency: collapses `.` segments and
 * duplicate slashes, and resolves `..` against the segments already seen. Used only to double-check
 * `isSafeBundlePath` below, whose earlier guards already reject any literal `..` segment — so this
 * can never observe one to resolve, but it stays faithful to the original's belt-and-suspenders check.
 */
function normalizeRelative(p: string): string {
  const out: string[] = []
  for (const seg of p.split('/')) {
    if (seg === '' || seg === '.') continue
    if (seg === '..') {
      if (out.length > 0 && out[out.length - 1] !== '..') out.pop()
      else out.push('..')
    } else {
      out.push(seg)
    }
  }
  return out.join('/') || '.'
}

/**
 * A bundle entry may only name a file inside the bundle: no absolute path, no `..` segment, no
 * backslash, and nothing whose normalized form climbs out. Everything downstream joins these onto
 * the project directory, so an escaping name would write outside it.
 */
export function isSafeBundlePath(rel: string): boolean {
  if (rel === '' || rel.startsWith('/') || /^[A-Za-z]:/.test(rel) || rel.includes('\\')) return false
  if (rel.split('/').includes('..')) return false
  return !normalizeRelative(`x/${rel}`).startsWith('..')
}
