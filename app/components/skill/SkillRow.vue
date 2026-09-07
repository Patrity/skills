<script setup lang="ts">
import type { SkillSummary } from '~~/shared/types/skills'

/**
 * One bundle in the `/skills` list (the `.brow` row of the approved design).
 *
 * The whole plate navigates, but not by nesting buttons inside an anchor: the name is
 * the only link and its `::after` covers the row, so the row stays one tab stop and the
 * action cluster keeps its own semantics on top of the overlay.
 */
defineProps<{
  skill: SkillSummary
  /** The tag currently filtering the list; the matching chip lights up. */
  activeTag?: string | null
}>()

const { tree } = useGithubUrls()
const { trackDownload, trackSource } = useAnalytics()
</script>

<template>
  <div
    data-skill-row
    class="group glass-card glow relative grid grid-cols-[28px_minmax(0,1fr)] items-start gap-3 p-4 transition-colors hover:border-primary/30 focus-within:border-primary/45 md:grid-cols-[34px_minmax(0,1fr)_auto] md:gap-4 md:p-5"
  >
    <SkillIcon
      :icon="skill.icon"
      :size="34"
      class="mt-0.5 size-7 md:size-[34px]"
    />

    <div class="min-w-0">
      <h3 class="m-0 mb-1.5 font-teko text-2xl font-semibold leading-[.9] tracking-[-0.01em] md:text-[28px]">
        <NuxtLink
          :to="`/skill/${skill.slug}`"
          class="text-default no-underline transition-colors after:absolute after:inset-0 after:rounded-xl group-hover:text-primary"
        >
          {{ skill.name }}
        </NuxtLink>
      </h3>
      <p class="m-0 mb-2.5 text-sm/[1.55] text-muted">
        {{ skill.description }}
      </p>

      <div class="flex flex-wrap items-center gap-1.5">
        <SkillTagChips
          :tags="skill.tags"
          :active="activeTag"
        />
        <span
          v-if="skill.tags.length && skill.badges.length"
          class="mx-1 h-3.5 w-px bg-(--ui-border)"
          aria-hidden="true"
        />
        <SkillBadges
          :badges="skill.badges"
          variant="icon"
        />
      </div>

      <p
        v-if="skill.errors.length"
        class="mt-2 text-xs text-error"
      >
        {{ skill.errors.length }} validation {{ skill.errors.length === 1 ? 'issue' : 'issues' }}
      </p>
    </div>

    <!-- Third grid cell on desktop; wraps under the text column on a phone. -->
    <div class="relative z-10 col-start-2 flex items-center gap-1 md:col-start-3 md:row-start-1">
      <InstallBox
        variant="icon"
        :command="`pnpx @patrity/skills add ${skill.slug}`"
        :slug="skill.slug"
      />
      <UTooltip text="Source on GitHub">
        <a
          :href="tree(skill.slug)"
          target="_blank"
          rel="noopener"
          class="inline-flex rounded-md border border-default bg-elevated p-[0.4375rem] text-muted transition-colors hover:border-primary/45 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          :aria-label="`${skill.name} source on GitHub`"
          @click="trackSource(skill.slug)"
        >
          <UIcon
            name="i-simple-icons-github"
            class="size-4"
          />
        </a>
      </UTooltip>
      <UTooltip text="Download zip">
        <a
          :href="`/api/skills/${skill.slug}/download`"
          class="inline-flex rounded-md border border-default bg-elevated p-[0.4375rem] text-muted transition-colors hover:border-primary/45 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          :aria-label="`Download ${skill.name} as a zip`"
          @click="trackDownload(skill.slug, 'index')"
        >
          <UIcon
            name="i-lucide-download"
            class="size-4"
          />
        </a>
      </UTooltip>
    </div>
  </div>
</template>
