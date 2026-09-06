<script setup lang="ts">
import type { ContentBadge } from '~~/shared/types/skills'

withDefaults(defineProps<{
  badges: ContentBadge[]
  /**
   * `outline` is the bordered pill with its label, for the bundle header.
   * `icon` is a glyph plus tooltip, for a list row where the tags already carry the words.
   */
  variant?: 'outline' | 'icon'
}>(), { variant: 'outline' })

const META: Record<ContentBadge, { label: string, icon: string }> = {
  'skills': { label: 'Skills', icon: 'i-lucide-book-open' },
  'rules': { label: 'Rules', icon: 'i-lucide-scale' },
  'hooks': { label: 'Hooks', icon: 'i-lucide-zap' },
  'settings': { label: 'Settings', icon: 'i-lucide-sliders-horizontal' },
  'claude-md': { label: 'CLAUDE.md', icon: 'i-lucide-file-text' }
}
</script>

<template>
  <div class="flex flex-wrap items-center gap-2">
    <template v-if="variant === 'icon'">
      <UTooltip
        v-for="badge in badges"
        :key="badge"
        :text="META[badge].label"
      >
        <span class="inline-flex items-center">
          <UIcon
            :name="META[badge].icon"
            class="size-[13px] text-primary"
          />
          <!-- The tooltip is mouse-only; this is what a screen reader reads. -->
          <span class="sr-only">{{ META[badge].label }}</span>
        </span>
      </UTooltip>
    </template>

    <template v-else>
      <span
        v-for="badge in badges"
        :key="badge"
        class="inline-flex items-center gap-1.5 rounded-md border border-default bg-elevated px-2 py-1 text-xs text-muted"
      >
        <UIcon
          :name="META[badge].icon"
          class="size-3.5 text-primary"
        />
        {{ META[badge].label }}
      </span>
    </template>

    <span
      v-if="!badges.length"
      class="text-xs text-dimmed"
    >No recognised .claude content</span>
  </div>
</template>
