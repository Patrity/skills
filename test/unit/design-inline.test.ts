import { describe, expect, it } from 'vitest'
import { inlinePreview } from '../../scripts/design-inline'

describe('inlinePreview', () => {
  it('replaces the shared stylesheet link with inline CSS and the mark include with the SVG', () => {
    const html = '<!-- @dsCard group="Components" -->\n<link rel="stylesheet" href="../_shared/tokens.css">\n<i data-include="mark.svg"></i>'
    const out = inlinePreview(html, { 'tokens.css': ':root{--x:1}', 'mark.svg': '<svg id="m"></svg>' })
    expect(out.startsWith('<!-- @dsCard group="Components" -->')).toBe(true)
    expect(out).toContain('<style>:root{--x:1}</style>')
    expect(out).toContain('<svg id="m"></svg>')
    expect(out).not.toContain('_shared/')
  })

  it('turns a relative svg url() inside the inlined CSS into a data URI', () => {
    const html = '<link rel="stylesheet" href="../_shared/tokens.css">'
    const out = inlinePreview(html, {
      'tokens.css': '.hive-texture{background-image:url("hive-texture.svg")}',
      'hive-texture.svg': '<svg stroke="#39a10e"></svg>'
    })
    expect(out).toContain('url("data:image/svg+xml;utf8,')
    // `#` must be percent-encoded or the browser reads it as a fragment.
    expect(out).toContain('%2339a10e')
    expect(out).not.toContain('url("hive-texture.svg")')
  })

  it('leaves an unknown include or url alone rather than emitting an empty string', () => {
    const html = '<i data-include="missing.svg"></i>\n<style>a{background:url("nope.svg")}</style>'
    const out = inlinePreview(html, {})
    expect(out).toContain('<i data-include="missing.svg"></i>')
    expect(out).toContain('url("nope.svg")')
  })

  it('inlines every stylesheet link regardless of how deep the relative path is', () => {
    const html = '<link rel="stylesheet" href="./_shared/tokens.css">\n<link rel="stylesheet" href="../../_shared/extra.css">'
    const out = inlinePreview(html, { 'tokens.css': 'a{}', 'extra.css': 'b{}' })
    expect(out).toContain('<style>a{}</style>')
    expect(out).toContain('<style>b{}</style>')
    expect(out).not.toContain('<link rel="stylesheet"')
  })

  it('keeps the Google Fonts stylesheet link untouched', () => {
    const html = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Teko:wght@600">'
    expect(inlinePreview(html, {})).toBe(html)
  })
})
