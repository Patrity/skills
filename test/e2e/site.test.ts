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

  // A bundle lives at /skill/<slug>, singular, so the prefix rule alone would leave nothing
  // current there. isNavCurrent names that case; both paths have to light Skills up.
  for (const path of ['/skills', '/skill/demo']) {
    it(`marks the current nav item with aria-current on ${path}`, async () => {
      const header = section(await (await fetch(path)).text(), 'header')
      expect(header).toMatch(/<a[^>]*(href="\/skills"[^>]*aria-current="page"|aria-current="page"[^>]*href="\/skills")/)
    })
  }

  it('opens the header socials in a new tab, marked rel="me noopener"', async () => {
    const header = section(await (await fetch('/')).text(), 'header')
    expect(header).toMatch(/<a[^>]*href="https:\/\/github\.com\/Patrity"[^>]*rel="me noopener"/)
    expect(header).toMatch(/<a[^>]*href="https:\/\/x\.com\/Patrity"[^>]*rel="me noopener"/)
  })
})

/**
 * Nuxt renders error.vue INSTEAD of app.vue, so none of the shell the layout mounts comes
 * for free here. It has to be built by hand, and this is what proves it still is.
 */
describe('error page', () => {
  /**
   * Nuxt's error handler answers JSON unless the request says it takes HTML, and the bare
   * test fetch sends only the wildcard accept header, which does not qualify. A browser
   * always asks for text/html, so that is what these send.
   */
  const page = (path = '/definitely-not-a-page') => fetch(path, { headers: { accept: 'text/html' } })

  it('answers 404 on an unknown URL', async () => {
    expect((await page()).status).toBe(404)
  })

  it('takes its single h1 from the status code', async () => {
    const html = withoutComments(await (await page()).text())
    expect(html.match(/<h1[\s>]/g) ?? []).toHaveLength(1)
    expect(html).toMatch(/<h1[^>]*>\s*404\s*<\/h1>/)
  })

  it('renders the site header and footer', async () => {
    const html = await (await page()).text()
    expect(section(html, 'header')).toContain('href="https://www.techhivelabs.net/blog"')
    expect(section(html, 'footer')).toContain('href="https://x.com/Patrity"')
  })

  it('titles and favicons itself, which app.vue never gets to do', async () => {
    const html = await (await page()).text()
    expect(html).toContain('<title>404 · Skills</title>')
    expect(html).toContain('href="/favicon.svg"')
    expect(html).toContain('href="/favicon.ico"')
  })
})

describe('/', () => {
  it('opens on the plain first-person paragraph, with no status pill', async () => {
    const html = withoutComments(await (await fetch('/')).text())
    expect(html).toContain('This is the Claude Code setup I use on my own projects: a CLAUDE.md, some rules, skills and hooks. It is split into bundles so you can take the parts that fit and leave the rest. The web builder and the CLI write the same files.')
    // The pill counted the registry ("9 bundles · 14 questions"); the copy rules dropped it.
    expect(html).not.toMatch(/\d+ bundles? · \d+ questions?/)
  })

  it('captions the transcript without a file count', async () => {
    const html = withoutComments(await (await fetch('/')).text())
    expect(html).toContain('One run into an empty project, and what it wrote.')
  })

  it('gives every section a heading that describes it', async () => {
    const html = withoutComments(await (await fetch('/')).text())
    for (const heading of ['What the run writes', 'Why the setup looks like this', 'The bundles', 'Take what you want']) {
      expect(html, heading).toMatch(new RegExp(`<h2[^>]*>\\s*${escapeRe(heading)}\\s*</h2>`))
    }
  })

  it('closes on the invitation, not on a verdict', async () => {
    const html = withoutComments(await (await fetch('/')).text())
    expect(html).toContain('Take the whole thing, or just the bundle you came for.')
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

  it('demotes a non-README file title to h2 under the bundle header', async () => {
    const html = withoutComments(await (await fetch('/skill/demo/rules/demo.md')).text())
    // rules/demo.md opens `# Demo rule`. The header owns the page's h1, so the file's own
    // title is demoted rather than dropped: losing it would leave the rule unnamed.
    expect(html).toMatch(/<h2[^>]*>[^<]*Demo rule/)
    expect(html).not.toMatch(/<h1[^>]*>[^<]*Demo rule/)
  })

  // A CLAUDE.md opens at `##`, settings.json is not markdown at all and a shell script
  // renders as code: none of them can supply a heading, so the header has to. rules/demo.md
  // does open at `#`, and still leaves the header's h1 the only one on the page.
  for (const path of ['CLAUDE.md', 'settings.json', 'hooks/pre-commit.sh', 'rules/demo.md']) {
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

  it('puts an axis with an info block behind a focusable popover glyph', async () => {
    const html = withoutComments(await (await fetch('/build')).text())
    // The panel is rendered on open, so the trigger is what the HTML can prove. It has to be a
    // popover trigger, not a tooltip's: only a popover's panel can hold a link you can tab to.
    const button = html.match(/<button[^>]*data-axis-info="layout"[^>]*>/)?.[0] ?? ''
    expect(button).toContain('aria-label="About this question"')
    expect(button).toContain('aria-haspopup="dialog"')
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

  it('recommends Superpowers before the first step, with both marketplaces', async () => {
    const html = withoutComments(await (await fetch('/docs/start-here')).text())
    expect(html).toMatch(/<h2[^>]*>\s*Before you start\s*<\/h2>/)
    expect(html).toContain('href="https://github.com/obra/superpowers"')
    expect(html).toContain('href="https://claude.com/plugins/superpowers"')
    expect(html).toContain('/plugin install superpowers@claude-plugins-official')
    expect(html).toContain('/plugin marketplace add obra/superpowers-marketplace')
    expect(html).toContain('/plugin install superpowers@superpowers-marketplace')
  })

  it('drops the next link on the last doc', async () => {
    const html = withoutComments(await (await fetch('/docs/contributing')).text())
    expect(html).toContain('href="https://github.com/Patrity/skills/edit/main/content/docs/contributing.md"')
    expect(html).not.toContain('Next:')
  })
})

describe('author card', () => {
  /**
   * The card's markup: from the attribute it carries to the site footer, which is the next
   * thing on the page. Scoping matters — the footer links the same profile.
   */
  function card(html: string): string {
    const open = html.indexOf('data-author-card')
    if (open === -1) return ''
    const end = html.indexOf('<footer', open)
    return end === -1 ? html.slice(open) : html.slice(open, end)
  }

  for (const path of ['/docs/start-here', '/skill/demo']) {
    it(`renders the author card on ${path}`, async () => {
      const html = withoutComments(await (await fetch(path)).text())
      const section = card(html)
      expect(section, 'no [data-author-card] on the page').not.toBe('')
      expect(section).toContain('Tony Costanzo')
      expect(section).toContain('TechHive Labs')
      // Blog stays in the same tab; X is a profile, so it opens away with rel="me".
      expect(section).toMatch(/<a[^>]*href="https:\/\/www\.techhivelabs\.net\/blog"/)
      expect(section).toMatch(/<a[^>]*href="https:\/\/x\.com\/Patrity"[^>]*rel="me noopener"/)
      expect(section).toMatch(/<a[^>]*href="https:\/\/x\.com\/Patrity"[^>]*target="_blank"/)
    })
  }

  it('keeps the card on the README only, not on the other files in a bundle', async () => {
    const html = withoutComments(await (await fetch('/skill/demo/CLAUDE.md')).text())
    expect(html).not.toContain('data-author-card')
  })
})

describe('structured data', () => {
  interface LdNode { '@type'?: string | string[], [key: string]: unknown }

  /** Every JSON-LD node on the page, with `@graph` flattened out. */
  function ldNodes(html: string): LdNode[] {
    const nodes: LdNode[] = []
    for (const match of html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) {
      const parsed = JSON.parse(match[1]!) as LdNode | LdNode[]
      const list = Array.isArray(parsed) ? parsed : (parsed['@graph'] as LdNode[] | undefined) ?? [parsed]
      nodes.push(...list)
    }
    return nodes
  }

  function ofType(nodes: LdNode[], type: string): LdNode[] {
    return nodes.filter((n) => {
      const t = n['@type']
      return Array.isArray(t) ? t.includes(type) : t === type
    })
  }

  it('describes the author as a Person on the home page', async () => {
    const nodes = ldNodes(await (await fetch('/')).text())
    const people = ofType(nodes, 'Person')
    expect(people.length).toBeGreaterThan(0)
    const person = people.find(p => p.name === 'Tony Costanzo')
    expect(person, 'no Person named Tony Costanzo').toBeTruthy()
    expect(person!.url).toBe('https://www.techhivelabs.net')
    expect(person!.sameAs).toEqual(expect.arrayContaining([
      'https://x.com/Patrity',
      'https://github.com/Patrity',
      'https://bsky.app/profile/patrity.com',
      'https://www.linkedin.com/in/tonycos/'
    ]))
  })

  it('describes a bundle as SoftwareSourceCode', async () => {
    const nodes = ldNodes(await (await fetch('/skill/demo')).text())
    const code = ofType(nodes, 'SoftwareSourceCode')[0]
    expect(code, 'no SoftwareSourceCode node').toBeTruthy()
    expect(code!.name).toBe('Demo')
    expect(code!.description).toBeTruthy()
    expect(code!.codeRepository).toBe('https://github.com/Patrity/skills/tree/main/skills/demo')
    expect(code!.programmingLanguage).toBe('Markdown')
    expect((code!.author as { name?: string } | undefined)?.name).toBe('Tony Costanzo')
  })

  it('keeps the Person on every page of the shell', async () => {
    for (const path of PAGES) {
      const nodes = ldNodes(await (await fetch(path)).text())
      expect(ofType(nodes, 'Person').some(p => p.name === 'Tony Costanzo'), path).toBe(true)
    }
  })
})

describe('page meta', () => {
  function metas(html: string, property: string): string[] {
    const re = new RegExp(`<meta[^>]*(?:property|name)="${escapeRe(property)}"[^>]*>`, 'g')
    return html.match(re) ?? []
  }

  const TITLES: Record<string, string> = {
    '/': 'The Claude Code setup I actually run · Skills',
    '/skills': 'All skills · Skills',
    '/skill/demo': 'Demo · Skills',
    '/build': 'Build your setup · Skills',
    '/docs/start-here': 'Start here · Skills'
  }

  /**
   * The title nuxt-og-image baked into the signed card URL. Props ride in the path as
   * `title_<value>`: form-encoded (spaces as `+`) when that round-trips, and base64url
   * behind a `~` when it does not.
   */
  function ogCardTitle(html: string): string {
    const url = html.match(/<meta property="og:image" content="([^"]+)"/)?.[1]
    expect(url, 'no og:image meta').toBeTruthy()
    const segment = new URL(url!.replace(/&amp;/g, '&')).pathname.split(',').find(p => p.startsWith('title_'))
    expect(segment, `no title prop in ${url}`).toBeTruthy()
    const raw = segment!.slice('title_'.length)
    return raw.startsWith('~')
      ? Buffer.from(raw.slice(1), 'base64url').toString('utf8')
      : decodeURIComponent(raw.replace(/\+/g, '%20'))
  }

  // fitOgTitle() cuts the card's title at 42 characters, so a title carrying the site name
  // twice comes back with an ellipsis. The card draws the wordmark already.
  it('draws each card title whole, without the site suffix', async () => {
    expect(ogCardTitle(await (await fetch('/')).text())).toBe('The Claude Code setup I actually run')
    expect(ogCardTitle(await (await fetch('/skill/demo')).text())).toBe('Demo')
    expect(ogCardTitle(await (await fetch('/docs/start-here')).text())).toBe('Start here')
  })

  for (const path of PAGES) {
    it(`titles ${path} through the app template`, async () => {
      const html = await (await fetch(path)).text()
      expect(html).toContain(`<title>${TITLES[path]}</title>`)
    })

    it(`emits exactly one og:title, og:description, description and og:image on ${path}`, async () => {
      const html = withoutComments(await (await fetch(path)).text())
      for (const property of ['og:title', 'og:description', 'description', 'og:image', 'twitter:card']) {
        expect(metas(html, property), `${path} ${property}`).toHaveLength(1)
      }
    })
  }
})
