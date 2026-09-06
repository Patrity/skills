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
