import { describe, expect, it } from 'vitest'
import { MARK_ACCENT, MARK_HEXAGON_POINTS, MARK_SLASH, MARK_VIEWBOX, markSvg } from '../../shared/brand/mark'

/** All the `<tag …>` openings of one kind in a string. */
function tags(svg: string, name: string): string[] {
  return svg.match(new RegExp(`<${name}\\b[^>]*>`, 'g')) ?? []
}

describe('markSvg', () => {
  it('draws exactly one hexagon and one slash', () => {
    const svg = markSvg({ size: 40, outline: 'currentColor' })
    expect(tags(svg, 'polygon')).toHaveLength(1)
    expect(tags(svg, 'line')).toHaveLength(1)
    expect(svg.startsWith('<svg')).toBe(true)
    expect(svg.trimEnd().endsWith('</svg>')).toBe(true)
  })

  it('places the hexagon on the shared geometry', () => {
    const polygon = tags(markSvg({ size: 40, outline: 'currentColor' }), 'polygon')[0]!
    expect(polygon).toContain(`points="${MARK_HEXAGON_POINTS}"`)
    expect(polygon).toContain('fill="none"')
    expect(MARK_HEXAGON_POINTS).toBe('50,4 90,27 90,73 50,96 10,73 10,27')
  })

  it('strokes the slash in the brand green, whatever the outline is', () => {
    const line = tags(markSvg({ size: 40, outline: '#fafafa' }), 'line')[0]!
    expect(line).toContain(`stroke="${MARK_ACCENT}"`)
    expect(MARK_ACCENT).toBe('#46c211')
    expect(line).toContain(`x1="${MARK_SLASH.x1}"`)
    expect(line).toContain(`y1="${MARK_SLASH.y1}"`)
    expect(line).toContain(`x2="${MARK_SLASH.x2}"`)
    expect(line).toContain(`y2="${MARK_SLASH.y2}"`)
  })

  it('renders at the requested size on a fixed viewBox', () => {
    const svg = markSvg({ size: 64, outline: 'currentColor' })
    expect(svg).toContain('width="64"')
    expect(svg).toContain('height="64"')
    expect(svg).toContain(`viewBox="${MARK_VIEWBOX}"`)
    expect(MARK_VIEWBOX).toBe('0 0 100 100')
  })

  it('outlines the hexagon in the requested colour', () => {
    expect(tags(markSvg({ size: 24, outline: 'currentColor' }), 'polygon')[0]).toContain('stroke="currentColor"')
    expect(tags(markSvg({ size: 24, outline: '#171717' }), 'polygon')[0]).toContain('stroke="#171717"')
  })

  it('carries an optional <style> block for the favicon\'s light-mode outline', () => {
    const plain = markSvg({ size: 100, outline: '#fafafa' })
    expect(plain).not.toContain('<style>')

    const styled = markSvg({ size: 100, outline: '#fafafa', style: '@media (prefers-color-scheme: light){polygon{stroke:#171717}}' })
    expect(styled).toContain('<style>@media (prefers-color-scheme: light){polygon{stroke:#171717}}</style>')
  })
})
