/**
 * The Skills mark: one outlined hexagon with a green `/` through it.
 *
 * The geometry lives here rather than in the SFC because three places draw the same
 * shape and they must not drift: `app/components/brand/BrandMark.vue` (the site),
 * `app/components/OgImage/Skills.satori.vue` (the social card, rendered by satori)
 * and `public/favicon.svg` (written once from `markSvg`, see the Task 5 report).
 *
 * Source of truth for the numbers: `docs/design/previews/_shared/mark.svg`.
 */

/** Every consumer draws on the same 100×100 canvas and scales with width/height. */
export const MARK_VIEWBOX = '0 0 100 100'

/** Pointy-top hexagon, inset far enough that a 6px stroke never clips the box. */
export const MARK_HEXAGON_POINTS = '50,4 90,27 90,73 50,96 10,73 10,27'

/** The slash, top-right to bottom-left. */
export const MARK_SLASH = { x1: 62, y1: 30, x2: 38, y2: 70 } as const

/** green-400 — the slash keeps it in both colour modes; only the outline flips. */
export const MARK_ACCENT = '#46c211'

/** Stroke widths, in viewBox units. */
export const MARK_HEXAGON_STROKE_WIDTH = 6
export const MARK_SLASH_STROKE_WIDTH = 9

export interface MarkSvgOptions {
  /** Rendered width and height in px (the viewBox is fixed). */
  size: number
  /** Hexagon stroke: `currentColor` in the app, a literal colour in the favicon. */
  outline: string
  /**
   * Optional CSS injected as a `<style>` element. Only the favicon uses it — a
   * standalone SVG cannot inherit `currentColor`, so it flips its own outline on
   * `prefers-color-scheme`.
   */
  style?: string
}

/** The complete `<svg>` markup for the mark. */
export function markSvg({ size, outline, style }: MarkSvgOptions): string {
  const { x1, y1, x2, y2 } = MARK_SLASH
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${MARK_VIEWBOX}" width="${size}" height="${size}" aria-hidden="true">`,
    ...(style ? [`  <style>${style}</style>`] : []),
    `  <polygon points="${MARK_HEXAGON_POINTS}" fill="none" stroke="${outline}" stroke-width="${MARK_HEXAGON_STROKE_WIDTH}" stroke-linejoin="round"/>`,
    `  <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${MARK_ACCENT}" stroke-width="${MARK_SLASH_STROKE_WIDTH}" stroke-linecap="round"/>`,
    '</svg>',
    ''
  ].join('\n')
}
