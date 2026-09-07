import type { MarkdownBody } from '../../../shared/types/skills'

/**
 * Drop the body's leading top-level `h1`, in place, and report whether one went.
 *
 * A page that renders its own display title (the skill page header, the docs page's nav
 * title) would otherwise print the same words twice and ship a second `<h1>`. Only the
 * FIRST node is considered: a `#` further down the document is the author's, and stays.
 */
export function dropLeadingH1(body: MarkdownBody): boolean {
  const first = body.children[0]
  if (!first || first.type !== 'element' || first.tag !== 'h1') return false
  body.children.shift()
  return true
}

/**
 * Turn the body's leading top-level `h1` into an `h2`, in place, and report whether one
 * was there.
 *
 * For a file whose title is NOT the page's title: every markdown file under a bundle
 * except the README. The page header already spends the `<h1>` on the bundle name, so the
 * file's own `# Title` cannot stay an `h1`. Dropping it would lose the only line that says
 * which rule or skill you are reading, so it is demoted instead: same words, one level down.
 *
 * Only the FIRST node is considered, same as `dropLeadingH1`.
 */
export function demoteLeadingH1(body: MarkdownBody): boolean {
  const first = body.children[0]
  if (!first || first.type !== 'element' || first.tag !== 'h1') return false
  first.tag = 'h2'
  return true
}
