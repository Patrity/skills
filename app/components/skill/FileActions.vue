<script setup lang="ts">
const props = defineProps<{
  slug: string
  path: string
  isMarkdown: boolean
  content: string | null
}>()

const view = defineModel<'rendered' | 'source'>('view', { required: true })

const VIEWS = [
  { value: 'rendered' as const, label: 'Rendered' },
  { value: 'source' as const, label: 'Source' }
]

const { blob } = useGithubUrls()
const { trackDownload, trackSource } = useAnalytics()
const toast = useToast()

async function copyRaw() {
  if (!props.content) return
  try {
    await navigator.clipboard.writeText(props.content)
  } catch {
    toast.add({ title: 'Could not copy .. select the file and copy it manually', icon: 'i-lucide-clipboard-x', color: 'error' })
    return
  }
  toast.add({ title: 'Copied raw file', icon: 'i-lucide-clipboard-check', color: 'success' })
}
</script>

<template>
  <div class="flex items-center gap-1.5">
    <SegmentedControl
      v-if="isMarkdown"
      v-model="view"
      :items="VIEWS"
      label="File view"
    />

    <UTooltip text="Copy raw file">
      <UButton
        icon="i-lucide-clipboard"
        color="neutral"
        variant="ghost"
        size="sm"
        :disabled="!content"
        aria-label="Copy raw file"
        @click="copyRaw"
      />
    </UTooltip>
    <UTooltip text="View on GitHub">
      <UButton
        icon="i-simple-icons-github"
        color="neutral"
        variant="ghost"
        size="sm"
        :to="blob(slug, path)"
        target="_blank"
        aria-label="View this file on GitHub"
        @click="trackSource(slug)"
      />
    </UTooltip>
    <UTooltip text="Download bundle (.zip)">
      <UButton
        icon="i-lucide-download"
        color="neutral"
        variant="ghost"
        size="sm"
        :to="`/api/skills/${slug}/download`"
        external
        aria-label="Download bundle"
        @click="trackDownload(slug, 'detail')"
      />
    </UTooltip>
  </div>
</template>
