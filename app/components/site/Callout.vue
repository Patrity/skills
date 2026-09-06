<script setup lang="ts">
/**
 * The `.callout` plate from the approved design: a glass card with a coloured left rule.
 * The palette is green, so `warning` darkens rather than turning amber. `error` is the
 * one place a non-brand colour earns its keep: a failed load must not read as decoration.
 */
withDefaults(defineProps<{
  icon: string
  title: string
  description?: string | null
  tone?: 'info' | 'warning' | 'error'
}>(), { description: null, tone: 'info' })

const TONE = {
  info: { rule: 'border-l-primary', icon: 'text-primary' },
  warning: {
    rule: 'border-l-(--color-green-700) dark:border-l-(--color-green-300)',
    icon: 'text-(--color-green-700) dark:text-(--color-green-300)'
  },
  error: { rule: 'border-l-error', icon: 'text-error' }
} as const
</script>

<template>
  <div
    class="glass-card grid grid-cols-[20px_minmax(0,1fr)] items-start gap-3.5 border-l-2 p-5"
    :class="TONE[tone].rule"
  >
    <UIcon
      :name="icon"
      class="mt-px size-5"
      :class="TONE[tone].icon"
    />
    <div class="min-w-0">
      <p class="m-0 font-teko text-[22px] font-semibold leading-none tracking-[-0.01em] text-default">
        {{ title }}
      </p>
      <p
        v-if="description"
        class="m-0 mt-1.5 text-[0.9375rem]/[1.6] text-muted"
      >
        {{ description }}
      </p>
      <slot />
    </div>
  </div>
</template>
