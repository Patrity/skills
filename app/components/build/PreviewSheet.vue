<script setup lang="ts">
/**
 * The preview on a phone: a fixed bar pinned to the bottom with the download on it, which
 * expands to 80vh of preview. Only mounted below `lg` (the page swaps it for the sticky
 * column), so the download button is never in the page twice.
 */
const props = defineProps<{
  /** The mono line on the bar, e.g. `CLAUDE.md · 5 bundles`. */
  summary: string
  /**
   * How many warnings the plan carries. The callout that spells them out lives inside the
   * preview, which is only mounted while the sheet is open, so the bar has to say that
   * something is wrong: some of them mean a file is missing from the zip.
   */
  warnings: number
  valid: boolean
  downloading: boolean
}>()

const emit = defineEmits<{ download: [] }>()

const open = defineModel<boolean>('open', { required: true })
const view = defineModel<'claude' | 'files'>('view', { required: true })

const VIEWS = [
  { value: 'claude' as const, label: 'CLAUDE.md' },
  { value: 'files' as const, label: 'Files' }
]

const panelId = useId()

const warningLabel = computed(() => `${props.warnings} warning${props.warnings === 1 ? '' : 's'}`)
</script>

<template>
  <div class="fixed inset-x-0 bottom-0 z-30 border-t border-default bg-(--ui-bg-elevated)/92 backdrop-blur-xl lg:hidden">
    <div
      v-show="open"
      :id="panelId"
      class="flex max-h-[80vh] min-h-0 flex-col overflow-y-auto border-b border-default p-3"
    >
      <slot />
    </div>

    <div
      class="mx-auto mt-2 mb-1 h-1 w-9 rounded-full bg-(--ui-border)"
      aria-hidden="true"
    />

    <div class="flex items-center justify-between gap-3 px-3.5 pt-1.5">
      <div class="flex min-w-0 items-center gap-2">
        <span class="truncate font-mono text-xs text-muted">{{ summary }}</span>
        <button
          v-if="warnings > 0"
          type="button"
          class="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-md font-mono text-xs text-(--color-green-700) transition-colors hover:text-(--color-green-600) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary dark:text-(--color-green-300)"
          :aria-label="`${warningLabel}, open the preview`"
          @click="open = true"
        >
          <UIcon
            name="i-lucide-triangle-alert"
            class="size-3.5"
          />
          {{ warningLabel }}
        </button>
      </div>
      <SegmentedControl
        v-model="view"
        :items="VIEWS"
        label="Preview"
      />
    </div>

    <div class="flex gap-2 px-3.5 pt-2.5 pb-[calc(0.875rem+env(safe-area-inset-bottom))]">
      <UButton
        data-build-download
        label="Download setup"
        icon="i-lucide-download"
        class="flex-1 justify-center"
        :loading="downloading"
        :disabled="!valid"
        @click="emit('download')"
      />
      <UButton
        color="neutral"
        variant="outline"
        icon="i-lucide-chevron-up"
        :ui="{ leadingIcon: open ? 'rotate-180 transition-transform' : 'transition-transform' }"
        :aria-expanded="open"
        :aria-controls="panelId"
        :aria-label="open ? 'Close the preview' : 'Open the preview'"
        @click="open = !open"
      />
    </div>
  </div>
</template>
