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
  titleTemplate: title => (title ? `${title} · Skills` : 'Skills — reusable Claude Code setups'),
  htmlAttrs: { lang: 'en' },
  link: [
    { rel: 'canonical', href: canonical },
    { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }
  ]
})

useSeoMeta({
  twitterCard: 'summary',
  ogSiteName: 'Skills',
  ogType: 'website'
})
</script>

<template>
  <UApp>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
