<script setup lang="ts">
import type { ContentBadge } from '~~/shared/types/skills'

defineProps<{ badges: ContentBadge[] }>()

const META: Record<ContentBadge, { label: string, icon: string }> = {
  'skills': { label: 'Skills', icon: 'i-lucide-graduation-cap' },
  'rules': { label: 'Rules', icon: 'i-lucide-scale' },
  'hooks': { label: 'Hooks', icon: 'i-lucide-webhook' },
  'settings': { label: 'Settings', icon: 'i-lucide-settings-2' },
  'claude-md': { label: 'CLAUDE.md', icon: 'i-lucide-file-text' }
}
</script>

<template>
  <div class="flex flex-wrap gap-1.5">
    <UBadge
      v-for="badge in badges"
      :key="badge"
      :label="META[badge].label"
      :icon="META[badge].icon"
      color="neutral"
      variant="subtle"
      size="sm"
    />
    <span
      v-if="!badges.length"
      class="text-xs text-dimmed"
    >No recognised .claude content</span>
  </div>
</template>
