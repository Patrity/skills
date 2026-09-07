<script setup lang="ts">
import { docsNav } from '~~/content/docs/nav'
import { LINKS } from '~~/shared/utils/links'

const route = useRoute()
const { public: { siteUrl } } = useRuntimeConfig()

// `/docs` renders the first doc rather than redirecting, so both URLs point at the
// same canonical one. Read the slug off the nav so a reorder cannot leave this
// pointing at a doc that moved. Trailing slashes are stripped everywhere else.
const canonical = computed(() => {
  const base = siteUrl.replace(/\/+$/, '')
  const path = /^\/docs\/?$/.test(route.path) ? `/docs/${docsNav[0]!.slug}` : route.path.replace(/(.)\/+$/, '$1')
  return `${base}${path}`
})

useHead({
  titleTemplate: title => (title ? `${title} · Skills` : 'Skills · the Claude Code setup I use'),
  htmlAttrs: { lang: 'en' },
  link: [
    { rel: 'canonical', href: canonical },
    // Modern browsers take the SVG (it flips with the OS colour scheme); the ICO is the
    // fallback for the ones that don't.
    { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
    { rel: 'icon', type: 'image/x-icon', sizes: '16x16 32x32 48x48', href: '/favicon.ico' }
  ]
})

useSeoMeta({
  twitterCard: 'summary_large_image',
  ogSiteName: 'Skills',
  ogType: 'website'
})

// Site-wide default card. Pages override it with their own title through useSiteSeo().
// `defineOgImage(component, props)` is v6's name for what the plan calls
// `defineOgImageComponent`: same arguments; the old name only logs a deprecation.
defineOgImage('Skills', { title: 'Skills' })

// One author for the whole site. `definePerson` gives the node the `#identity` id the
// module's other nodes (WebSite, WebPage) point at, so this is the site's author rather
// than a stray Person floating in the graph. `sameAs` is the same profile list the footer
// links with rel="me" — the machine-readable half of the same claim.
useSchemaOrg([
  definePerson({
    name: 'Tony Costanzo',
    url: LINKS.lab,
    sameAs: [LINKS.x, LINKS.github, LINKS.bluesky, LINKS.linkedin]
  })
])
</script>

<template>
  <UApp>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
