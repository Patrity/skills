<script setup lang="ts">
import { docsNav } from '~~/content/docs/nav'

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
  titleTemplate: title => (title ? `${title} · Skills` : 'Skills.. the Claude Code setup I actually run'),
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

// Site-wide default card. Pages override it with their own title (Task 11).
// `defineOgImage(component, props)` is v6's name for what the plan calls
// `defineOgImageComponent`: same arguments; the old name only logs a deprecation.
defineOgImage('Skills', { title: 'Skills' })
</script>

<template>
  <UApp>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
