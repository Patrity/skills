<script setup lang="ts">
import type { SkillSummary } from '~~/shared/types/skills'
import { formatBytes } from '~~/shared/utils/format'

const props = defineProps<{
  skill: SkillSummary
  from: 'index' | 'detail'
}>()

const { tree } = useGithubUrls()
const { trackDownload, trackSource } = useAnalytics()
const downloadUrl = computed(() => `/api/skills/${props.skill.slug}/download`)

// The whole card navigates, but the title link, the author link and the Source /
// Download buttons keep their own behaviour — bail out when the click started
// inside one of them, otherwise the card would navigate on top of them.
function onCardClick(e: MouseEvent) {
  if ((e.target as HTMLElement | null)?.closest('a,button')) return
  navigateTo(`/skill/${props.skill.slug}`)
}
</script>

<template>
  <UPageCard
    variant="subtle"
    class="cursor-pointer"
    :ui="{
      root: 'transition-shadow hover:ring-primary/40 hover:shadow-sm',
      container: 'gap-3 min-w-0',
      wrapper: 'min-w-0',
      footer: 'w-full min-w-0'
    }"
    @click="onCardClick"
  >
    <!--
      UPageCard (v4.11) only auto-renders #title/#description as part of the
      #body slot's *default* content; supplying a custom #body slot replaces
      that default entirely, so #title/#description would silently be dropped.
      Rendered manually here with the component's own theme classes instead.
    -->
    <template #body>
      <NuxtLink
        :to="`/skill/${skill.slug}`"
        class="block text-base text-pretty font-semibold text-highlighted hover:text-primary transition-colors"
      >
        {{ skill.name }}
      </NuxtLink>
      <p class="mt-1 text-[15px] text-pretty text-toned">
        {{ skill.description }}
      </p>
      <div class="flex flex-wrap gap-1.5 mt-3">
        <UBadge
          v-for="tag in skill.tags"
          :key="tag"
          :label="tag"
          color="primary"
          variant="soft"
          size="sm"
        />
      </div>
      <SkillBadges
        :badges="skill.badges"
        class="mt-2"
      />
      <p
        v-if="skill.errors.length"
        class="mt-2 text-xs text-error"
      >
        {{ skill.errors.length }} validation {{ skill.errors.length === 1 ? 'issue' : 'issues' }}
      </p>
    </template>

    <template #footer>
      <div class="flex flex-wrap items-center justify-between gap-2 w-full min-w-0">
        <span class="text-xs text-muted min-w-0">
          by
          <ULink
            v-if="skill.authorUrl"
            :to="skill.authorUrl"
            target="_blank"
            class="text-default"
          >{{ skill.author }}</ULink>
          <span v-else>{{ skill.author }}</span>
          · {{ skill.fileCount }} files · {{ formatBytes(skill.totalBytes) }}
        </span>
        <UFieldGroup
          size="xs"
          class="shrink-0"
        >
          <UButton
            label="Source"
            icon="i-simple-icons-github"
            color="neutral"
            variant="outline"
            :to="tree(skill.slug)"
            target="_blank"
            @click="trackSource(skill.slug)"
          />
          <UButton
            label="Download"
            icon="i-lucide-download"
            color="neutral"
            variant="outline"
            :to="downloadUrl"
            external
            @click="trackDownload(skill.slug, from)"
          />
        </UFieldGroup>
      </div>
    </template>
  </UPageCard>
</template>
