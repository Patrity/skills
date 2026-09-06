<script setup lang="ts">
import type { SkillSummary } from '~~/shared/types/skills'

const props = defineProps<{
  skills: SkillSummary[]
  selected: string[]
  /** slug → the ticked bundles that depend on it. A non-empty entry locks the row. */
  locked: Record<string, string[]>
  recommended: string[]
}>()

const emit = defineEmits<{
  toggle: [slug: string]
}>()

/** One flat list in name order, as approved: the tag chips carry the grouping the headings did. */
const rows = computed(() => [...props.skills].sort((a, b) => a.name.localeCompare(b.name)))

const isSelected = (slug: string) => props.selected.includes(slug)
const lockReason = (slug: string) => {
  const by = props.locked[slug]
  return by?.length ? `Required by ${by.join(', ')}` : ''
}
</script>

<template>
  <ul class="grid list-none gap-2 p-0">
    <li
      v-for="skill in rows"
      :key="skill.slug"
    >
      <div
        class="flex items-center gap-2.5 rounded-lg border bg-elevated px-3 py-2 transition-colors"
        :class="isSelected(skill.slug) ? 'border-primary/45' : 'border-default'"
      >
        <UCheckbox
          :model-value="isSelected(skill.slug)"
          :label="skill.name"
          :disabled="!!lockReason(skill.slug)"
          :data-bundle="skill.slug"
          :ui="{ root: 'min-w-0 items-center', wrapper: 'w-auto min-w-0', label: 'text-sm text-default' }"
          @update:model-value="emit('toggle', skill.slug)"
        />

        <SkillTagChips
          v-if="skill.tags.length"
          :tags="skill.tags"
          class="hidden min-w-0 sm:flex"
        />

        <span
          v-if="!lockReason(skill.slug) && recommended.includes(skill.slug)"
          class="ms-auto shrink-0 font-mono text-[0.6875rem] text-dimmed"
        >recommended</span>

        <!-- The row is disabled rather than refusing the click, so the reason has to be
             readable without one: the tooltip sits on a focusable glyph. -->
        <UTooltip
          v-else-if="lockReason(skill.slug)"
          :text="lockReason(skill.slug)"
        >
          <button
            type="button"
            class="ms-auto inline-flex shrink-0 cursor-help rounded-sm p-0.5 text-dimmed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            :aria-label="lockReason(skill.slug)"
          >
            <UIcon
              name="i-lucide-lock"
              class="size-3.5"
            />
          </button>
        </UTooltip>
      </div>
    </li>
  </ul>
</template>
