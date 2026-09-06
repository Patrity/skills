/** Separators that must not be left dangling in front of the ellipsis. */
const TRAILING_SEPARATORS = /[\s.,;:!?·—–-]+$/

/**
 * Fit a title into the OG card's title line.
 *
 * The card gives the title two lines of Teko 600 at 72px; past ~42 characters a third
 * line appears and the lockup below it is pushed off the canvas. So: collapse
 * whitespace, and if the title still does not fit, cut it back to the last whole word
 * and end it with an ellipsis. The ellipsis counts against `max`, so the return value
 * is never longer than `max`.
 */
export function fitOgTitle(title: string, max = 42): string {
  const clean = String(title ?? '').replace(/\s+/g, ' ').trim()
  if (clean.length <= max) return clean
  if (max <= 1) return '…'

  const cut = clean.slice(0, max - 1)
  const lastSpace = cut.lastIndexOf(' ')
  // A first word longer than the budget has no boundary to fall back to: hard-cut it.
  const head = (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).replace(TRAILING_SEPARATORS, '')
  return `${head}…`
}
