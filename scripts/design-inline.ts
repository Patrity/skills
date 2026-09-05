/**
 * Builds the Claude Design cards: every preview under `docs/design/previews/` is copied to
 * `dist/design/` with its `_shared/` dependencies inlined, so each card is a single file whose
 * only external request is Google Fonts.
 *
 * `pnpm design:build`
 */
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const SHARED_LINK_RE = /<link\b[^>]*?href="[^"]*?_shared\/([^"]+)"[^>]*>/g
const INCLUDE_RE = /<i\s+data-include="([^"]+)"\s*><\/i>/g
const CSS_URL_RE = /url\((["']?)(?!data:|https?:)([^"')]+\.svg)\1\)/g

/** A relative asset referenced from CSS becomes a data URI so the card stays one file. */
function dataUri(svg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg.trim())}`
}

function inlineCssAssets(css: string, shared: Record<string, string>): string {
  return css.replace(CSS_URL_RE, (whole, _quote: string, name: string) => {
    const asset = shared[name]
    return asset === undefined ? whole : `url("${dataUri(asset)}")`
  })
}

/**
 * Inlines `_shared/*.css` stylesheet links, `<i data-include="…">` SVG includes and any relative
 * `url(*.svg)` inside the inlined CSS. Anything not present in `shared` is left untouched.
 */
export function inlinePreview(html: string, shared: Record<string, string>): string {
  return html
    .replace(SHARED_LINK_RE, (whole, name: string) => {
      const css = shared[name]
      return css === undefined ? whole : `<style>${inlineCssAssets(css.trim(), shared)}</style>`
    })
    .replace(INCLUDE_RE, (whole, name: string) => shared[name] ?? whole)
}

async function readShared(dir: string): Promise<Record<string, string>> {
  const out: Record<string, string> = {}
  for (const name of await readdir(dir)) out[name] = await readFile(join(dir, name), 'utf8')
  return out
}

/** Every `.html` under `dir`, excluding `_shared`, as paths relative to `dir`. */
async function previewFiles(dir: string, prefix = ''): Promise<string[]> {
  const out: string[] = []
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name === '_shared') continue
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name
    if (entry.isDirectory()) out.push(...await previewFiles(join(dir, entry.name), rel))
    else if (entry.name.endsWith('.html')) out.push(rel)
  }
  return out.sort()
}

export async function buildPreviews(root: string): Promise<string[]> {
  const src = join(root, 'docs/design/previews')
  const out = join(root, 'dist/design')
  const shared = await readShared(join(src, '_shared'))
  const written: string[] = []
  for (const rel of await previewFiles(src)) {
    const html = await readFile(join(src, rel), 'utf8')
    const target = join(out, rel)
    await mkdir(dirname(target), { recursive: true })
    await writeFile(target, inlinePreview(html, shared))
    written.push(relative(root, target))
  }
  return written
}

const isMain = process.argv[1] !== undefined
  && resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isMain) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
  const written = await buildPreviews(root)
  for (const path of written) console.log(`✓ ${path}`)
  console.log(`${written.length} cards → dist/design`)
}
