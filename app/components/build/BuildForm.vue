<script setup lang="ts">
import type { BaseAxis, CliManifest } from '~~/shared/types/setup'
import type { BuildState } from '~~/shared/setup/build-state'
import { cliCommand, encodeBuildState } from '~~/shared/setup/build-state'
import { CUSTOM_PRESET } from '~/composables/useBuildState'

const props = defineProps<{
  manifest: CliManifest
  state: BuildState
  preset: string
  axes: BaseAxis[]
  /** slug → the ticked bundles that depend on it. */
  lockedBy: Record<string, string[]>
  recommended: string[]
  valid: boolean
  nameError: string | null
}>()

const emit = defineEmits<{
  'update:preset': [value: string]
  'update:projectName': [value: string]
  'answer': [id: string, value: string]
  'toggle': [slug: string]
}>()

const toast = useToast()
const { trackBuildDownload, trackBuildCopyCli } = useAnalytics()

const presetItems = computed(() => [
  ...props.manifest.profiles.map(p => ({ value: p.name, label: p.name, description: p.description })),
  { value: CUSTOM_PRESET, label: 'Custom', description: 'Start from the defaults' }
])

const presetModel = computed<string>({
  get: () => props.preset,
  set: value => emit('update:preset', value)
})

const projectName = computed<string>({
  get: () => props.state.projectName,
  set: value => emit('update:projectName', value)
})

const command = computed(() => cliCommand(props.state, props.manifest))
const analyticsProfile = computed(() => props.state.profile ?? CUSTOM_PRESET)

/** A 400 from `/api/build` carries `{ statusMessage }`; with `responseType: 'blob'` it arrives as a Blob. */
async function messageFor(e: unknown): Promise<string> {
  const err = e as { statusMessage?: string, message?: string, data?: unknown }
  const read = (value: unknown): string | null => {
    if (!value || typeof value !== 'object') return null
    const message = (value as { statusMessage?: unknown, message?: unknown }).statusMessage
      ?? (value as { message?: unknown }).message
    return typeof message === 'string' ? message : null
  }
  if (err.data instanceof Blob) {
    try {
      return read(JSON.parse(await err.data.text())) ?? err.message ?? 'Unknown error'
    } catch {
      // Not JSON — fall through to the fetch error's own message.
    }
  }
  return read(err.data) ?? err.statusMessage ?? err.message ?? 'Unknown error'
}

const downloading = ref(false)

async function download() {
  downloading.value = true
  try {
    const blob = await $fetch<Blob>('/api/build', {
      method: 'POST',
      body: { projectName: props.state.projectName, answers: props.state.answers, bundles: props.state.bundles },
      responseType: 'blob'
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${props.state.projectName}-claude-setup.zip`
    document.body.appendChild(link)
    link.click()
    link.remove()
    // Revoking synchronously cancels the download in Safari; one tick is enough.
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    trackBuildDownload(analyticsProfile.value, props.state.bundles, props.state.answers)
  } catch (e) {
    toast.add({ title: 'Could not build the zip', description: await messageFor(e), icon: 'i-lucide-triangle-alert', color: 'error' })
  } finally {
    downloading.value = false
  }
}

async function copy(text: string, title: string): Promise<boolean> {
  // navigator.clipboard is undefined outside a secure context and writeText() rejects when the
  // permission is denied — neither should surface as an unhandled rejection.
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    toast.add({ title: 'Could not copy — select the text and copy it manually', icon: 'i-lucide-clipboard-x', color: 'error' })
    return false
  }
  toast.add({ title, icon: 'i-lucide-clipboard-check', color: 'success' })
  return true
}

async function copyCli() {
  if (await copy(command.value, 'CLI command copied')) trackBuildCopyCli(analyticsProfile.value)
}

async function copyShareLink() {
  // Built from the state rather than read off `location`, which the debounced hash write may
  // not have caught up with yet.
  await copy(`${window.location.origin}${window.location.pathname}#${encodeBuildState(props.state)}`, 'Share link copied')
}
</script>

<template>
  <div class="space-y-6 min-w-0">
    <UFormField
      label="Preset"
      description="A starting point. Change anything below and the preset becomes Custom."
    >
      <URadioGroup
        v-model="presetModel"
        variant="card"
        :items="presetItems"
        :ui="{ fieldset: 'grid grid-cols-1 sm:grid-cols-2 gap-2 w-full' }"
      />
    </UFormField>

    <UFormField
      label="Project name"
      description="Used as the CLAUDE.md title and in scaffolded paths."
      :error="nameError ?? undefined"
    >
      <UInput
        v-model="projectName"
        placeholder="my-project"
        class="w-full"
      />
    </UFormField>

    <div class="space-y-4">
      <BuildAxisField
        v-for="axis in axes"
        :key="axis.id"
        :axis="axis"
        :value="state.answers[axis.id]"
        @update="(id, value) => emit('answer', id, value)"
      />
    </div>

    <!--
      A fieldset, not a UFormField: UFormField binds its label to the single control it wraps, and
      around a list of checkboxes that made every row announce the whole group's labels.
    -->
    <fieldset class="space-y-2">
      <legend class="text-sm font-medium text-default">
        Bundles
      </legend>
      <p class="text-xs text-muted">
        Everything ticked here lands under .claude/, with its CLAUDE.md section merged in.
      </p>
      <BuildBundlePicker
        :skills="manifest.skills"
        :selected="state.bundles"
        :locked="lockedBy"
        :recommended="recommended"
        @toggle="slug => emit('toggle', slug)"
      />
    </fieldset>

    <div class="flex flex-wrap items-center gap-2">
      <UButton
        label="Download setup"
        icon="i-lucide-download"
        :loading="downloading"
        :disabled="!valid"
        @click="download"
      />
      <UButton
        label="Copy CLI command"
        icon="i-lucide-terminal"
        color="neutral"
        variant="outline"
        @click="copyCli"
      />
      <UButton
        label="Copy share link"
        icon="i-lucide-link"
        color="neutral"
        variant="ghost"
        @click="copyShareLink"
      />
    </div>

    <div class="rounded-md border border-default bg-muted px-3 py-2 overflow-x-auto">
      <code class="text-xs font-mono text-muted whitespace-pre">{{ command }}</code>
    </div>
  </div>
</template>
