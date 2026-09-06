import { describe, expect, it } from 'vitest'
import { fileURLToPath } from 'node:url'
import { $fetch, fetch, setup } from '@nuxt/test-utils/e2e'
import type { SkillsListResponse } from '../../shared/types/skills'

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

describe('/skills', () => {
  it('renders one row per bundle the API returns', async () => {
    const list = await $fetch<SkillsListResponse>('/api/skills')
    expect(list.skills.length).toBeGreaterThan(0)

    const html = withoutComments(await (await fetch('/skills')).text())
    expect(html.match(/data-skill-row/g) ?? []).toHaveLength(list.skills.length)
    for (const skill of list.skills) {
      expect(html, skill.slug).toContain(`href="/skill/${skill.slug}"`)
      expect(html, skill.slug).toContain(skill.name)
    }
  })

  it('renders the search field and the tag chips', async () => {
    const html = withoutComments(await (await fetch('/skills')).text())
    expect(html).toMatch(/<input[^>]*type="search"/)
    // Chips are toggle buttons, so their state is announced rather than implied by colour.
    expect(html).toMatch(/<button[^>]*aria-pressed="false"/)
  })
})

describe('/skill/demo', () => {
  it('renders the bundle header: install command and meta list', async () => {
    const html = withoutComments(await (await fetch('/skill/demo')).text())
    expect(html).toContain('pnpx @patrity/skills add demo')
    // From the fixture frontmatter — the meta list, not the SEO tags.
    expect(html).toContain('Tester')
    expect(html).toContain('python3')
  })

  it('renders the file tree', async () => {
    const html = withoutComments(await (await fetch('/skill/demo')).text())
    expect(html).toContain('role="tree"')
    // Root-level rows (a collapsed folder's children are not server-rendered). The
    // data attribute is the tree's own, so this cannot pass on a stray mention.
    expect(html).toContain('data-tree-path="README.md"')
    expect(html).toContain('data-tree-path="settings.json"')
  })

  it('renders the README without its own leading heading', async () => {
    const html = withoutComments(await (await fetch('/skill/demo')).text())
    expect(html).toContain('This README is rendered on')
    // The header owns the h1, so the README's `# Demo bundle` is dropped server-side
    // (renderMarkdown's dropLeadingH1) rather than becoming a second heading. The raw
    // source still ships in the payload, so assert on the headings, not the whole page.
    expect(html).not.toMatch(/<h1[^>]*>[^<]*Demo bundle/)
  })

  it('takes its single h1 from the page header, not the markdown', async () => {
    const html = withoutComments(await (await fetch('/skill/demo')).text())
    expect(html.match(/<h1[\s>]/g) ?? []).toHaveLength(1)
    expect(html).toMatch(/<h1[^>]*>\s*Demo\s*<\/h1>/)
  })

  // A CLAUDE.md opens at `##`, settings.json is not markdown at all and a shell script
  // renders as code: none of them can supply a heading, so the header has to.
  for (const path of ['CLAUDE.md', 'settings.json', 'hooks/pre-commit.sh']) {
    it(`renders exactly one h1 on /skill/demo/${path}`, async () => {
      const res = await fetch(`/skill/demo/${path}`)
      expect(res.status).toBe(200)
      const html = withoutComments(await res.text())
      expect(html.match(/<h1[\s>]/g) ?? []).toHaveLength(1)
      expect(html).toMatch(/<h1[^>]*>\s*Demo\s*<\/h1>/)
    })
  }
})

describe('/build', () => {
  it('renders the preview segmented control', async () => {
    const html = withoutComments(await (await fetch('/build')).text())
    // The strip is a button group, not a tablist: the choice is announced by aria-pressed.
    expect(html).toMatch(/<div[^>]*role="group"[^>]*aria-label="Preview"/)
    expect(html).toContain('CLAUDE.md')
    expect(html).toContain('Files')
  })

  it('renders the download button in the preview footer', async () => {
    const html = withoutComments(await (await fetch('/build')).text())
    expect(html).toMatch(/<button[^>]*data-build-download/)
    expect(html).toContain('Download setup')
  })

  it('asks the project name and the schema questions', async () => {
    const html = withoutComments(await (await fetch('/build')).text())
    expect(html).toContain('What is this project called?')
    // From the base schema the fixtures and the real repo share.
    expect(html).toContain('How is the repo laid out?')
  })
})

describe('/docs/start-here', () => {
  /** The first DocsNav on the page (the sticky one); the mobile disclosure renders a second. */
  function nav(html: string): string {
    const open = html.indexOf('data-docs-nav')
    const close = open === -1 ? -1 : html.indexOf('</nav>', open)
    return open === -1 || close === -1 ? '' : html.slice(open, close)
  }

  it('groups the nav under Start, Reference and Contribute, in that order', async () => {
    const html = withoutComments(await (await fetch('/docs/start-here')).text())
    const section = nav(html)
    expect(section).not.toBe('')
    const order = ['Start', 'Reference', 'Contribute'].map(g => section.indexOf(`>${g}<`))
    expect(order.every(i => i >= 0)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
  })

  it('links every doc in the nav and marks the current one', async () => {
    const html = withoutComments(await (await fetch('/docs/start-here')).text())
    const section = nav(html)
    for (const slug of ['start-here', 'philosophy', 'cli', 'contributing']) {
      expect(section, slug).toContain(`href="/docs/${slug}"`)
    }
    expect(section).toMatch(/<a[^>]*(href="\/docs\/start-here"[^>]*aria-current="page"|aria-current="page"[^>]*href="\/docs\/start-here")/)
  })

  it('takes its single h1 from the nav entry, not the markdown', async () => {
    const html = withoutComments(await (await fetch('/docs/start-here')).text())
    expect(html.match(/<h1[\s>]/g) ?? []).toHaveLength(1)
    expect(html).toMatch(/<h1[^>]*>\s*Start here\s*<\/h1>/)
  })

  it('links the doc source for editing and the next doc in nav order', async () => {
    const html = withoutComments(await (await fetch('/docs/start-here')).text())
    expect(html).toContain('href="https://github.com/Patrity/skills/edit/main/content/docs/start-here.md"')
    expect(html).toContain('Edit on GitHub')
    expect(html).toMatch(/<a[^>]*href="\/docs\/philosophy"[^>]*>[\s\S]*?Philosophy/)
  })

  it('drops the next link on the last doc', async () => {
    const html = withoutComments(await (await fetch('/docs/contributing')).text())
    expect(html).toContain('href="https://github.com/Patrity/skills/edit/main/content/docs/contributing.md"')
    expect(html).not.toContain('Next:')
  })
})
