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
      <UTooltip :ui="{ content: 'h-auto max-w-72 items-start p-2.5' }">
        <button
          type="button"
          :data-axis-info="axis.id"
          aria-label="About this question"
          class="inline-flex cursor-help rounded-sm p-0.5 text-dimmed transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <UIcon
            name="i-lucide-info"
            class="size-4"
          />
        </button>

        <template #content>
          <span class="block text-xs/[1.5] font-normal text-default">
            {{ axis.info.text }}
            <a
              v-if="axis.info.href"
              :href="axis.info.href"
              target="_blank"
              rel="noopener"
              class="whitespace-nowrap text-primary underline underline-offset-2"
            >{{ axis.info.label ?? 'Repo' }} ↗</a>
          </span>
        </template>
      </UTooltip>
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
