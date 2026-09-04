<script setup lang="ts">
import type { BaseAxis } from '~~/shared/types/setup'

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
</script>

<template>
  <UFormField
    :label="axis.question"
    :description="axis.description"
    :name="axis.id"
  >
    <USelect
      v-if="axis.options?.length"
      v-model="model"
      :items="items"
      class="w-full"
    />
    <UInput
      v-else
      v-model="model"
      :placeholder="axis.input?.placeholder"
      class="w-full"
    />
  </UFormField>
</template>
