<script setup lang="ts">
import type { SkillSummary } from '~~/shared/types/skills'
import { groupByTag } from '~~/shared/setup/wizard'

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

const groups = computed(() => Object.entries(groupByTag(props.skills)).sort(([a], [b]) => a.localeCompare(b)))

const isSelected = (slug: string) => props.selected.includes(slug)
const lockReason = (slug: string) => {
  const by = props.locked[slug]
  return by?.length ? `Required by ${by.join(', ')}` : ''
}
</script>

<template>
  <div class="space-y-4">
    <div
      v-for="[tag, list] in groups"
      :key="tag"
      class="space-y-2"
    >
      <p class="text-xs font-semibold uppercase tracking-wide text-dimmed">
        {{ tag }}
      </p>
      <ul class="space-y-2">
        <li
          v-for="skill in list"
          :key="skill.slug"
        >
          <UTooltip
            :text="lockReason(skill.slug)"
            :disabled="!lockReason(skill.slug)"
          >
            <div
              class="w-full rounded-md border p-3"
              :class="isSelected(skill.slug) ? 'border-accented bg-elevated/40' : 'border-default'"
            >
              <UCheckbox
                :model-value="isSelected(skill.slug)"
                :label="skill.name"
                :description="skill.description"
                :disabled="!!lockReason(skill.slug)"
                :data-bundle="skill.slug"
                @update:model-value="emit('toggle', skill.slug)"
              />
              <div class="mt-2 flex flex-wrap items-center gap-1.5 ps-6">
                <UBadge
                  v-if="lockReason(skill.slug)"
                  label="required"
                  icon="i-lucide-lock"
                  color="neutral"
                  variant="outline"
                  size="sm"
                />
                <UBadge
                  v-else-if="recommended.includes(skill.slug)"
                  label="recommended"
                  color="primary"
                  variant="subtle"
                  size="sm"
                />
                <SkillBadges :badges="skill.badges" />
              </div>
            </div>
          </UTooltip>
        </li>
      </ul>
    </div>
  </div>
</template>
