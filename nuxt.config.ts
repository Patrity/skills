import { copyFile, mkdir } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

// satori (0.33) shapes text with harfbuzzjs, which reads `hb.wasm` off disk at runtime via
// `__dirname + '/hb.wasm'`. node-file-trace follows hb.js but never sees that read, so the
// built server answers every OG image with
// `ENOENT <serverDir>/node_modules/harfbuzzjs/hb.wasm` — a 500 on Vercel, not just locally.
// `externals.traceInclude` cannot help (it resolves JS entries), so copy the file in once
// Nitro has written the output. Resolved through satori because harfbuzzjs is its
// dependency, not ours.
const hbWasmSource = createRequire(createRequire(import.meta.url).resolve('satori/package.json'))
  .resolve('harfbuzzjs/hb.wasm')

/** Put hb.wasm next to the hb.js that Nitro traced into the server bundle. */
async function copyHarfbuzzWasm(serverDir: string) {
  const dir = join(serverDir, 'node_modules/harfbuzzjs')
  await mkdir(dir, { recursive: true })
  await copyFile(hbWasmSource, join(dir, 'hb.wasm'))
}

export default defineNuxtConfig({
  modules: ['@nuxt/eslint', '@nuxt/ui', '@nuxtjs/mdc', 'nuxt-umami', '@nuxt/fonts', '@nuxtjs/seo'],

  // Public content site: SSR everywhere. CodeMirror is the only client-only piece.
  ssr: true,

  // `brand/` and `site/` hold the design-system primitives, used by name everywhere
  // (<BrandMark>, <InstallBox>, <SiteHeader>), so they lose the directory prefix. The
  // trailing default entry keeps every other directory prefixed as before
  // (SkillCard, BuildForm, OgImageSkillsSatori) — scanning stops at the first
  // directory that claims a file.
  components: [
    { path: '~/components/brand', pathPrefix: false },
    { path: '~/components/site', pathPrefix: false },
    '~/components'
  ],
  devtools: { enabled: true },
  css: ['~/assets/css/main.css'],

  site: {
    url: process.env.NUXT_PUBLIC_SITE_URL || 'https://skills.patrity.com',
    name: 'Skills',
    description: 'The Claude Code setup I actually run, as bundles you can take one at a time.',
    defaultLocale: 'en'
  },

  mdc: {
    // Fixed allow-list: the full Shiki grammar set has OOM'd Nuxt builds before.
    highlight: {
      langs: ['js', 'ts', 'json', 'yaml', 'bash', 'shell', 'md', 'python', 'vue', 'html', 'css', 'diff'],
      theme: { default: 'github-light', dark: 'github-dark' }
    },
    // Nuxt UI ProseH* crash on hydration when anchorLinks is an object (known bug).
    headings: { anchorLinks: false }
  },

  runtimeConfig: {
    // Server-only. Override with NUXT_GITHUB_TOKEN etc.
    githubToken: '',
    revalidateSecret: '',
    // 'fs' reads ./skills from disk (dev, CI); 'github' downloads the repo zip archive
    // (Vercel). Read here at build/dev time; the built server honours NUXT_SKILLS_SOURCE.
    skillsSource: process.env.SKILLS_SOURCE ?? (process.env.VERCEL ? 'github' : 'fs'),
    skillsDir: 'skills',
    public: {
      siteUrl: 'http://localhost:3000',
      github: { owner: 'Patrity', repo: 'skills', branch: 'main' }
    }
  },

  // ISR on Vercel. Every cached response is tagged so POST /api/revalidate can
  // invalidateByTag('skills'). Each distinct query string is its own cache entry, which is
  // why the file endpoint encodes the path in the URL (see server/api/skills/[slug]/file/)
  // instead of passing it as `?path=`.
  routeRules: {
    '/': { isr: 300, headers: { 'Vercel-Cache-Tag': 'skills' } },
    '/skills': { isr: 300, headers: { 'Vercel-Cache-Tag': 'skills' } },
    '/skill/**': { isr: 300, headers: { 'Vercel-Cache-Tag': 'skills' } },
    '/build': { isr: 300, headers: { 'Vercel-Cache-Tag': 'skills' } },
    // Renamed in the reframe; the old URL is public and indexed, so keep it pointing somewhere.
    '/docs/getting-started': { redirect: { to: '/docs/single-bundle', statusCode: 301 } },
    '/docs/**': { isr: true },
    '/api/docs/**': { isr: true },
    '/api/skills': { isr: 300, headers: { 'Vercel-Cache-Tag': 'skills' } },
    '/api/skills/**': { isr: 300, headers: { 'Vercel-Cache-Tag': 'skills' } },
    '/api/base': { isr: 300, headers: { 'Vercel-Cache-Tag': 'skills' } },
    '/api/profiles': { isr: 300, headers: { 'Vercel-Cache-Tag': 'skills' } },
    '/api/cli/**': { isr: 300, headers: { 'Vercel-Cache-Tag': 'skills' } },
    '/sitemap.xml': { isr: 300, headers: { 'Vercel-Cache-Tag': 'skills' } }
  },

  compatibilityDate: '2026-09-01',

  // Docs ship with the build (they describe the app, not the bundles), so bundle them as
  // Nitro server assets: the /api/docs route reads them from memory and a deploy is what
  // invalidates them.
  nitro: {
    serverAssets: [{ baseName: 'docs', dir: fileURLToPath(new URL('./content/docs', import.meta.url)) }]
  },

  // `nitro.hooks.compiled` would REPLACE the hook the deploy preset registers, not run
  // alongside it: Nitro merges preset into user config with defu, which overwrites
  // functions, and the vercel preset's own `compiled` is what writes
  // .vercel/output/config.json and every ISR .func / .prerender-config.json. Registering
  // through `nitro:init` adds a listener instead, so both run.
  hooks: {
    'nitro:init'(nitro) {
      nitro.hooks.hook('compiled', n => copyHarfbuzzWasm(n.options.output.serverDir))
    }
  },

  eslint: {
    config: { stylistic: { commaDangle: 'never', braceStyle: '1tbs' } }
  },

  // Teko (display) and JetBrains Mono (code) from Google. `global` is required twice
  // over: Tailwind 4 `@theme` variables are not scanned by @nuxt/fonts, and the OG
  // renderer only sees families that reached `nuxt-fonts-global.css`.
  fonts: {
    families: [
      { name: 'Teko', provider: 'google', weights: [500, 600, 700], global: true },
      { name: 'JetBrains Mono', provider: 'google', weights: [400, 500], global: true }
    ]
  },
  // @nuxtjs/seo bundles sitemap, robots and the link checker. We already serve
  // /sitemap.xml and /robots.txt from server/routes/, so the module's versions stay off
  // (they would shadow ours); the link checker is a dev-time nag we do not want.
  linkChecker: { enabled: false },

  // nuxt-og-image v6 takes its fonts from @nuxt/fonts and rejects `component`/`renderer`
  // inside `defaults` — the default template is the one app.vue registers with
  // defineOgImage(), and the renderer comes from the `.satori.vue` filename suffix.
  ogImage: {
    defaults: { width: 1200, height: 630 },
    // Runtime OG image URLs are signed. Left alone the module generates a fresh secret per
    // build, which invalidates every og:image URL already scraped or sitting in a social
    // cache (they are served immutable for 3 days). NUXT_OG_IMAGE_SECRET pins it in
    // production; locally it stays unset and the per-build random secret is fine.
    security: { secret: process.env.NUXT_OG_IMAGE_SECRET }
  },
  robots: { enabled: false },
  schemaOrg: { enabled: true },
  sitemap: { enabled: false },

  // nuxt-umami bakes its config at BUILD time. Set NUXT_PUBLIC_UMAMI_ID (and
  // UMAMI_DOMAINS) in Vercel's Production environment only; previews/dev stay in
  // faux (no-op) mode because `id` is empty.
  umami: {
    host: 'https://analytics.patrity.com',
    id: '',
    autoTrack: true,
    ignoreLocalhost: true,
    proxy: 'cloak',
    domains: process.env.UMAMI_DOMAINS ? process.env.UMAMI_DOMAINS.split(',') : null
  }
})
