<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

const { repo } = useGithubUrls()

const items: NavigationMenuItem[] = [
  { label: 'Home', icon: 'i-lucide-house', to: '/' },
  { label: 'Skills', icon: 'i-lucide-package', to: '/skills' },
  { label: 'Build', icon: 'i-lucide-hammer', to: '/build' },
  { label: 'Docs', icon: 'i-lucide-book-open', to: '/docs' },
  { label: 'GitHub', icon: 'i-simple-icons-github', to: repo, target: '_blank' }
]
</script>

<template>
  <UDashboardGroup storage-key="skills-dashboard">
    <!-- Sizes are percentages (Nuxt UI default unit). -->
    <UDashboardSidebar
      id="app-sidebar"
      collapsible
      resizable
      :default-size="14"
      :min-size="10"
      :max-size="20"
      class="bg-elevated/25"
    >
      <template #header="{ collapsed }">
        <NuxtLink
          to="/"
          class="flex items-center gap-2 mx-1 min-w-0"
        >
          <UIcon
            name="i-lucide-blocks"
            class="size-6 text-primary shrink-0"
          />
          <span
            v-if="!collapsed"
            class="text-sm font-semibold tracking-tight truncate"
          >Skills</span>
        </NuxtLink>
      </template>

      <template #default="{ collapsed }">
        <UNavigationMenu
          :collapsed="collapsed"
          :items="items"
          orientation="vertical"
          tooltip
        />
      </template>

      <template #footer="{ collapsed }">
        <UColorModeButton :block="collapsed" />
      </template>
    </UDashboardSidebar>

    <slot />
  </UDashboardGroup>
</template>
