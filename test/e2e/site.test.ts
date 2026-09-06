import { describe, expect, it } from 'vitest'
import { fileURLToPath } from 'node:url'
import { fetch, setup } from '@nuxt/test-utils/e2e'

const skillsDir = fileURLToPath(new URL('../fixtures/skills', import.meta.url))

await setup({
  rootDir: fileURLToPath(new URL('../..', import.meta.url)),
  server: true,
  setupTimeout: 240_000,
  nuxtConfig: {
    runtimeConfig: {
      skillsSource: 'fs',
      skillsDir,
      revalidateSecret: 'test-secret'
    }
  },
  // A root .env (see nuxt.config.ts) sets NUXT_SKILLS_DIR / NUXT_REVALIDATE_SECRET, which
  // override the runtimeConfig defaults above once the built server's own env resolution
  // runs. This spread wins: startServer merges { ...process.env, ...env }, so it lands
  // after anything .env loaded into the parent process and keeps the fixtures wired up.
  env: {
    NUXT_SKILLS_SOURCE: 'fs',
    NUXT_SKILLS_DIR: skillsDir,
    NUXT_REVALIDATE_SECRET: 'test-secret'
  }
})

/** Every page the shell wraps. `demo` is the fixture bundle. */
const PAGES = ['/', '/skills', '/skill/demo', '/build', '/docs/start-here']

/**
 * The shell's own `<header>` (the first one on the page — pages own later ones) and
 * `<footer>` (the last one — a page may grow its own footer block above it).
 */
function section(html: string, tag: 'header' | 'footer'): string {
  const open = tag === 'header' ? html.indexOf('<header') : html.lastIndexOf('<footer')
  const close = open === -1 ? -1 : html.indexOf(`</${tag}>`, open)
  return open === -1 || close === -1 ? '' : html.slice(open, close)
}

function escapeRe(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Vue ships template comments to the client, and ours talk about tags. Count real markup. */
function withoutComments(html: string): string {
  return html.replace(/<!--[\s\S]*?-->/g, '')
}

describe('site shell', () => {
  for (const path of PAGES) {
    describe(path, () => {
      it('renders exactly one <h1> and one <main>', async () => {
        const res = await fetch(path)
        expect(res.status).toBe(200)
        const html = withoutComments(await res.text())
        expect(html.match(/<h1[\s>]/g) ?? []).toHaveLength(1)
        expect(html.match(/<main[\s>]/g) ?? []).toHaveLength(1)
      })

      it('renders the header with the blog backlink', async () => {
        const header = section(await (await fetch(path)).text(), 'header')
        expect(header).not.toBe('')
        expect(header).toContain('href="https://www.techhivelabs.net/blog"')
      })

      it('renders the footer with the socials and the blog RSS link', async () => {
        const footer = section(await (await fetch(path)).text(), 'footer')
        expect(footer).not.toBe('')
        expect(footer).toContain('href="https://x.com/Patrity"')
        expect(footer).toContain('rel="me noopener"')
        expect(footer).toContain('href="https://www.techhivelabs.net/rss.xml"')
      })
    })
  }

  it('links every profile in the footer with rel="me noopener"', async () => {
    const footer = section(await (await fetch('/')).text(), 'footer')
    for (const href of [
      'https://github.com/Patrity',
      'https://x.com/Patrity',
      'https://bsky.app/profile/patrity.com',
      'https://www.linkedin.com/in/tonycos/'
    ]) {
      expect(footer, href).toMatch(new RegExp(`<a[^>]*href="${escapeRe(href)}"[^>]*rel="me noopener"`))
    }
  })

  it('links the registry column in the footer', async () => {
    const footer = section(await (await fetch('/')).text(), 'footer')
    expect(footer).toContain('href="https://www.npmjs.com/package/@patrity/skills"')
    expect(footer).toContain('href="https://github.com/Patrity/skills"')
    expect(footer).toContain('href="https://github.com/Patrity/skills/blob/main/LICENSE"')
    expect(footer).toContain(`© ${new Date().getFullYear()} Tony Costanzo`)
  })

  it('links the nav in the header, in order', async () => {
    const header = section(await (await fetch('/')).text(), 'header')
    const order = ['/skills', '/build', '/docs', 'https://www.techhivelabs.net/blog']
      .map(href => header.indexOf(`href="${href}"`))
    expect(order.every(i => i >= 0)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
  })

  it('marks the current nav item with aria-current', async () => {
    const header = section(await (await fetch('/skills')).text(), 'header')
    expect(header).toMatch(/<a[^>]*(href="\/skills"[^>]*aria-current="page"|aria-current="page"[^>]*href="\/skills")/)
  })

  it('opens the header socials in a new tab, marked rel="me noopener"', async () => {
    const header = section(await (await fetch('/')).text(), 'header')
    expect(header).toMatch(/<a[^>]*href="https:\/\/github\.com\/Patrity"[^>]*rel="me noopener"/)
    expect(header).toMatch(/<a[^>]*href="https:\/\/x\.com\/Patrity"[^>]*rel="me noopener"/)
  })
})
