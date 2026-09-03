<script setup lang="ts">
const route = useRoute()
const { public: { siteUrl } } = useRuntimeConfig()

// `/docs` renders the first doc rather than redirecting, so both URLs point at the
// same canonical one. Trailing slashes are stripped everywhere else.
const canonical = computed(() => {
  const base = siteUrl.replace(/\/+$/, '')
  const path = /^\/docs\/?$/.test(route.path) ? '/docs/getting-started' : route.path.replace(/(.)\/+$/, '$1')
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
