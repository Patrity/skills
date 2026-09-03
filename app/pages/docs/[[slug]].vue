<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'
import { docsNav } from '~~/content/docs/nav'
import { getDoc } from '~/utils/docs'

const route = useRoute()
const slug = computed(() => (typeof route.params.slug === 'string' && route.params.slug) || docsNav[0]!.slug)
const doc = computed(() => getDoc(slug.value))

if (!doc.value) {
  throw createError({ statusCode: 404, statusMessage: 'Doc not found', fatal: true })
}

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
  <div class="flex flex-1 min-w-0 h-full">
    <UDashboardPanel
      id="docs-nav"
      resizable
      :default-size="20"
      :min-size="14"
      :max-size="30"
      class="hidden lg:flex"
    >
      <template #header>
        <!--
          #left (not #title/#leading): DashboardNavbar.vue nests <h1 data-slot="title"> inside
          #left's own default content, unconditionally — overriding #title alone still renders
          an empty h1. Overriding #left replaces that whole default, so no h1 renders here at all.
        -->
        <UDashboardNavbar :toggle="false">
          <template #left>
            <UDashboardSidebarCollapse />
            <span class="text-sm font-semibold text-highlighted truncate">Docs</span>
          </template>
        </UDashboardNavbar>
      </template>
      <template #body>
        <UNavigationMenu
          :items="items"
          orientation="vertical"
        />
      </template>
    </UDashboardPanel>

    <UDashboardPanel
      id="docs-content"
      :ui="{ body: 'p-0 sm:p-0 gap-0' }"
    >
      <template #header>
        <UDashboardNavbar :title="doc?.entry.title">
          <template #leading>
            <UButton
              icon="i-lucide-list"
              color="neutral"
              variant="ghost"
              class="lg:hidden"
              aria-label="Docs navigation"
              @click="navOpen = true"
            />
          </template>
        </UDashboardNavbar>
      </template>
      <template #body>
        <div class="h-full overflow-y-auto">
          <div class="mx-auto max-w-3xl p-4 sm:p-6">
            <MarkdownView
              v-if="doc"
              :source="doc.source"
              :cache-key="`docs:${slug}`"
            />
          </div>
        </div>
      </template>
    </UDashboardPanel>

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
