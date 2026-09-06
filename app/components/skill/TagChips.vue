<script setup lang="ts">
/**
 * The mono pill row from the approved design (`.chip` / `.chip-active`).
 *
 * Two modes, one look: read-only spans inside a bundle row or the bundle header, and
 * toggle buttons on `/skills`. The interactive form is a real `<button>` with
 * `aria-pressed`, so the filter state is announced rather than implied by the green.
 *
 * Registers as `<SkillTagChips>`: Nuxt's directory prefix only dedups when the filename
 * already starts with it, and this one does not (same as `FileActions.vue`). An
 * unresolved `<TagChips>` renders as a silent unknown element, so use the prefixed name.
 */
const props = withDefaults(defineProps<{
  /** Tags in render order. */
  tags: readonly string[]
  /** Occurrences per tag. Given one, a chip shows its count beside the name. */
  counts?: Record<string, number> | null
  /** The tag currently filtering the list. */
  active?: string | null
  /** Chips become toggle buttons that emit `toggle`. */
  interactive?: boolean
  /** Accessible name for the group. Only read when `interactive`. */
  label?: string
}>(), {
  counts: null,
  active: null,
  interactive: false,
  label: 'Filter by tag'
})

const emit = defineEmits<{ toggle: [tag: string] }>()

function onClick(tag: string) {
  if (props.interactive) emit('toggle', tag)
}
</script>

<template>
  <div
    class="flex flex-wrap items-center gap-1.5"
    :role="interactive ? 'group' : undefined"
    :aria-label="interactive ? label : undefined"
  >
    <component
      :is="interactive ? 'button' : 'span'"
      v-for="tag in tags"
      :key="tag"
      :type="interactive ? 'button' : undefined"
      :aria-pressed="interactive ? String(active === tag) : undefined"
      class="inline-flex items-center gap-1.5 rounded-full border px-2 font-mono text-[0.6875rem]/[1.7]"
      :class="[
        active === tag ? 'border-primary text-primary bg-primary/12' : 'border-default text-muted',
        interactive && active !== tag ? 'hover:border-primary/45 hover:text-default' : '',
        interactive ? 'cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary' : ''
      ]"
      @click="onClick(tag)"
    >
      {{ tag }}
      <span
        v-if="counts?.[tag] !== undefined"
        :class="active === tag ? 'text-primary' : 'text-dimmed'"
      >{{ counts[tag] }}</span>
    </component>
  </div>
</template>
