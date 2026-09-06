<script setup lang="ts">
import type { BaseAxis, CliManifest } from '~~/shared/types/setup'
import type { BuildState } from '~~/shared/setup/build-state'
import { CUSTOM_PRESET } from '~/composables/useBuildState'
import { FIELD_UI, INPUT_UI } from './field-ui'

const props = defineProps<{
  manifest: CliManifest
  state: BuildState
  preset: string
  axes: BaseAxis[]
  /** slug → the ticked bundles that depend on it. */
  lockedBy: Record<string, string[]>
  recommended: string[]
  nameError: string | null
}>()

const emit = defineEmits<{
  'update:preset': [value: string]
  'update:projectName': [value: string]
  'answer': [id: string, value: string]
  'toggle': [slug: string]
}>()

const presetItems = computed(() => [
  ...props.manifest.profiles.map(p => ({ value: p.name, label: p.name, description: p.description })),
  { value: CUSTOM_PRESET, label: 'Custom', description: 'Start from the defaults and answer everything yourself.' }
])

const presetModel = computed<string>({
  get: () => props.preset,
  set: value => emit('update:preset', value)
})

const projectName = computed<string>({
  get: () => props.state.projectName,
  set: value => emit('update:projectName', value)
})

/** The preset tiles, glass with a green ring on the chosen one (approved `.tile` / `.tile.on`). */
const PRESET_UI = {
  legend: 'mb-3.5 block font-teko text-[30px] font-semibold leading-none tracking-[-0.01em] text-default',
  fieldset: 'grid w-full grid-cols-1 gap-2 sm:grid-cols-2',
  // The radio itself is `sr-only` under `indicator="hidden"`, so the tile carries the focus
  // ring: without this, tabbing through the presets shows nothing.
  item: 'glass-card w-full cursor-pointer rounded-xl border-default p-3 transition-colors hover:border-primary/45 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-primary has-data-[state=checked]:border-primary has-data-[state=checked]:ring-3 has-data-[state=checked]:ring-primary/14',
  wrapper: 'w-full items-start text-start',
  label: 'font-mono text-xs font-medium text-default',
  description: 'mt-1 block text-[0.6875rem]/[1.4] text-muted'
} as const

const SECTION_HEADING = 'm-0 mb-3.5 font-teko text-[30px] font-semibold leading-none tracking-[-0.01em] text-default'
const HELP = 'mt-2 font-mono text-[0.6875rem]/[1.5] text-dimmed'
</script>

<template>
  <!-- One explicit `minmax(0,1fr)` column: a grid item defaults to min-width:auto, so a long
       select value would push the field wider than the 480px track it sits in. -->
  <div class="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-7">
    <section>
      <!-- The radio group brings its own fieldset and legend; the legend is the section
           heading the design asks for, so the tiles stay one named group. -->
      <URadioGroup
        v-model="presetModel"
        legend="Start from a preset"
        variant="card"
        indicator="hidden"
        :items="presetItems"
        :ui="PRESET_UI"
      />
      <p :class="HELP">
        a preset answers every question; changing one answer keeps the rest
      </p>
    </section>

    <UFormField
      label="What is this project called?"
      description="names the CLAUDE.md heading and the project browser-testing skill"
      :error="nameError ?? undefined"
      :ui="FIELD_UI"
    >
      <UInput
        v-model="projectName"
        placeholder="my-project"
        class="w-full"
        :ui="INPUT_UI"
      />
    </UFormField>

    <BuildAxisField
      v-for="axis in axes"
      :key="axis.id"
      :axis="axis"
      :value="state.answers[axis.id]"
      @update="(id, value) => emit('answer', id, value)"
    />

    <!--
      A fieldset, not a UFormField: UFormField binds its label to the single control it wraps, and
      around a list of checkboxes that made every row announce the whole group's labels.
    -->
    <fieldset class="min-w-0">
      <legend :class="SECTION_HEADING">
        Bundles
      </legend>
      <BuildBundlePicker
        :skills="manifest.skills"
        :selected="state.bundles"
        :locked="lockedBy"
        :recommended="recommended"
        @toggle="slug => emit('toggle', slug)"
      />
      <p :class="HELP">
        a padlock means an answer above chose this one; change the answer to free it
      </p>
    </fieldset>
  </div>
</template>
