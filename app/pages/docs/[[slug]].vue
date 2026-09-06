<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'
import type { DocResponse } from '~~/shared/types/docs'
import { docsNav } from '~~/content/docs/nav'

const route = useRoute()
const slug = computed(() => (typeof route.params.slug === 'string' && route.params.slug) || docsNav[0]!.slug)

// Server-rendered: /api/docs/<slug> ships the parsed MDC AST, so the browser never runs the
// markdown parser or the per-code-block highlight round trips.
const { data: doc, error } = await useFetch<DocResponse>(() => `/api/docs/${encodeURIComponent(slug.value)}`)

// /docs/** is ISR: a transient 5xx must stay a 5xx (Vercel keeps serving the stale page),
// because a 404 would be cached and pin the doc as permanently missing.
function docError(err: { statusCode?: number } | null | undefined) {
  const statusCode = err?.statusCode ?? 500
  return createError({
    statusCode,
    statusMessage: statusCode === 404 ? 'Doc not found' : 'Docs are temporarily unavailable',
    fatal: true
  })
}
if (error.value) throw docError(error.value)
// One route record covers every slug, so setup does not re-run when the slug changes.
watch(error, (err) => {
  if (err) showError(docError(err))
})

const navOpen = ref(false)
const items = computed<NavigationMenuItem[]>(() => docsNav.map(d => ({
  label: d.title,
  to: `/docs/${d.slug}`,
  active: d.slug === slug.value,
  onSelect: () => {
    navOpen.value = false
  }
})))

const { public: { siteUrl } } = useRuntimeConfig()

useSeoMeta({
  title: () => doc.value?.entry.title ?? 'Docs',
  description: () => doc.value?.entry.description ?? '',
  ogTitle: () => doc.value?.entry.title ?? 'Docs',
  ogDescription: () => doc.value?.entry.description ?? '',
  ogUrl: () => `${siteUrl.replace(/\/+$/, '')}/docs/${slug.value}`
})
</script>

<template>
  <div class="mx-auto max-w-7xl px-4 sm:px-6 py-6">
    <div class="lg:grid lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-8">
      <!-- Side column, plain grid now that the dashboard panels are gone. -->
      <aside class="hidden lg:block min-w-0">
        <div class="sticky top-20 max-h-[calc(100dvh-6rem)] overflow-y-auto">
          <UNavigationMenu
            :items="items"
            orientation="vertical"
          />
        </div>
      </aside>

      <div class="min-w-0">
        <!--
          Page chrome only: the doc's own `# Title` is the page h1, so this row must not
          render a second one (Task 9 restyles it).
        -->
        <header class="lg:hidden flex items-center gap-2 mb-4 min-w-0">
          <UButton
            icon="i-lucide-list"
            color="neutral"
            variant="ghost"
            aria-label="Docs navigation"
            @click="navOpen = true"
          />
          <span class="text-sm font-semibold text-highlighted truncate">{{ doc?.entry.title }}</span>
        </header>

        <div class="mx-auto max-w-3xl">
          <MarkdownView
            v-if="doc"
            :body="doc.body"
            :data="doc.data"
          />
        </div>
      </div>
    </div>

    <USlideover
      v-model:open="navOpen"
      side="left"
      title="Docs"
    >
      <template #body>
        <UNavigationMenu
          :items="items"
          orientation="vertical"
        />
      </template>
    </USlideover>
  </div>
</template>
