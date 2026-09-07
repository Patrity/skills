<script setup lang="ts">
import type { NuxtError } from '#app'

/**
 * Nuxt renders this INSTEAD of app.vue, so nothing app.vue sets up reaches here: no
 * titleTemplate, no favicon links, no UApp for the toast host. The shell is rebuilt by
 * hand, and the header/footer are the same components the default layout mounts.
 */
const props = defineProps<{ error: NuxtError }>()

const code = computed(() => props.error.statusCode || 500)
const line = computed(() => (code.value === 404
  ? 'That page is not here. The bundle may have moved, or the link may never have been right.'
  : props.error.statusMessage || 'Something on my side broke. Try again in a minute.'))

useHead({
  // app.vue's titleTemplate never runs on this page, so the suffix is spelled out.
  title: () => `${code.value} · Skills`,
  link: [
    // Modern browsers take the SVG (it flips with the OS colour scheme); the ICO is the
    // fallback for the ones that don't.
    { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
    { rel: 'icon', type: 'image/x-icon', sizes: '16x16 32x32 48x48', href: '/favicon.ico' }
  ]
})

// No OG card is rendered for an error, so the large-image variant would point at nothing.
useSeoMeta({ twitterCard: 'summary' })
</script>

<template>
  <UApp>
    <div class="min-h-dvh flex flex-col">
      <SiteHeader />
      <main class="flex-1 flex items-center">
        <div class="mx-auto w-full max-w-7xl px-4 sm:px-6 py-16 lg:py-24">
          <MicroLabel class="block mb-3">
            Error
          </MicroLabel>
          <h1 class="m-0 font-teko text-[80px] font-semibold leading-[.9] tracking-[-0.015em] text-default lg:text-[120px]">
            {{ code }}
          </h1>
          <p class="mt-4 mb-0 max-w-[36rem] text-base/relaxed text-muted">
            {{ line }}
          </p>
          <div class="mt-7">
            <UButton
              label="Back home"
              icon="i-lucide-house"
              color="neutral"
              variant="subtle"
              @click="clearError({ redirect: '/' })"
            />
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  </UApp>
</template>
