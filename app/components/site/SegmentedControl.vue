<script setup lang="ts" generic="T extends string">
/**
 * The `.seg` control from the approved design: a bordered strip of toggle buttons with
 * the selected one filled green. Buttons carry `aria-pressed` and the strip an
 * accessible name, so the choice is announced without a radio group's arrow-key model.
 */
export interface SegmentedItem<Value extends string> {
  value: Value
  label: string
  icon?: string
}

defineProps<{
  items: readonly SegmentedItem<T>[]
  /** Accessible name for the strip, e.g. "File view". */
  label: string
}>()

const model = defineModel<T>({ required: true })
</script>

<template>
  <div
    role="group"
    :aria-label="label"
    class="inline-flex shrink-0 rounded-lg border border-default bg-elevated p-0.5"
  >
    <button
      v-for="item in items"
      :key="item.value"
      type="button"
      :aria-pressed="String(model === item.value)"
      class="inline-flex items-center gap-1.5 rounded-md px-3 py-[0.3125rem] text-[0.8125rem] cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      :class="model === item.value
        ? 'bg-(--color-green-500) text-white font-semibold'
        : 'text-muted hover:text-default'"
      @click="model = item.value"
    >
      <UIcon
        v-if="item.icon"
        :name="item.icon"
        class="size-3.5"
      />
      {{ item.label }}
    </button>
  </div>
</template>
