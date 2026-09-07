<script setup lang="ts">
import type { BaseAxis } from '~~/shared/types/setup'
import { FIELD_UI, INPUT_UI } from './field-ui'

const props = defineProps<{
  axis: BaseAxis
  value: string | undefined
}>()

const emit = defineEmits<{
  update: [id: string, value: string]
}>()

const items = computed(() => (props.axis.options ?? []).map(o => ({
  value: o.id,
  label: o.label,
  description: o.description
})))

// A select-style axis always has an answer; a text-style one may legitimately be empty.
const model = computed<string>({
  get: () => props.value ?? '',
  set: value => emit('update', props.axis.id, value)
})

// UFormField's hint slot sits beside the label and outside the <label> element, which is where
// the glyph has to be: a button inside a label would steal the click meant for the control.
// `justify-start` un-does the theme's justify-between so it reads as part of the question.
const fieldUi = computed(() => (props.axis.info ? { ...FIELD_UI, labelWrapper: 'justify-start gap-1.5' } : FIELD_UI))
</script>

<template>
  <UFormField
    :label="axis.question"
    :description="axis.description"
    :name="axis.id"
    :ui="fieldUi"
  >
    <template
      v-if="axis.info"
      #hint
    >
      <!--
        A popover, not a tooltip: tooltip content takes no focus, so the link inside one is
        mouse-only. Reka's popover moves focus into the panel on open, which puts the link one
        Tab away, and Escape closes it and hands focus back to the glyph. Click-only on purpose:
        `mode="hover"` swaps in a HoverCard, which opens on neither Enter nor Space.
      -->
      <UPopover
        :content="{ side: 'bottom', align: 'start' }"
        :ui="{ content: 'max-w-72 p-3' }"
      >
        <button
          type="button"
          :data-axis-info="axis.id"
          aria-label="About this question"
          class="inline-flex rounded-sm p-0.5 text-dimmed transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <UIcon
            name="i-lucide-info"
            class="size-4"
          />
        </button>

        <template #content>
          <p class="m-0 text-xs/[1.55] font-normal text-default">
            {{ axis.info.text }}
          </p>
          <a
            v-if="axis.info.href"
            :href="axis.info.href"
            target="_blank"
            rel="noopener"
            class="mt-2 inline-flex font-mono text-[0.6875rem] text-primary underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >{{ axis.info.label ?? 'Repo' }} ↗</a>
        </template>
      </UPopover>
    </template>

    <USelect
      v-if="axis.options?.length"
      v-model="model"
      :items="items"
      class="w-full"
      :ui="INPUT_UI"
    />
    <UInput
      v-else
      v-model="model"
      :placeholder="axis.input?.placeholder"
      class="w-full"
      :ui="INPUT_UI"
    />
  </UFormField>
</template>
