import { fileURLToPath } from 'node:url'

export default defineNuxtConfig({
  modules: ['@nuxt/eslint', '@nuxt/ui', '@nuxtjs/mdc', 'nuxt-umami'],

  // Public content site: SSR everywhere. CodeMirror is the only client-only piece.
  ssr: true,
  devtools: { enabled: true },
  css: ['~/assets/css/main.css'],

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

  eslint: {
    config: { stylistic: { commaDangle: 'never', braceStyle: '1tbs' } }
  },

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
