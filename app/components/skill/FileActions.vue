<script setup lang="ts">
const props = defineProps<{
  slug: string
  path: string
  isMarkdown: boolean
  content: string | null
}>()

const view = defineModel<'rendered' | 'source'>('view', { required: true })

const { blob } = useGithubUrls()
const { trackDownload, trackSource } = useAnalytics()
const toast = useToast()

async function copyRaw() {
  if (!props.content) return
  await navigator.clipboard.writeText(props.content)
  toast.add({ title: 'Copied raw file', icon: 'i-lucide-clipboard-check', color: 'success' })
}
</script>

<template>
  <div class="flex items-center gap-2">
    <UFieldGroup
      v-if="isMarkdown"
      size="xs"
    >
      <UButton
        label="Rendered"
        icon="i-lucide-eye"
        :color="view === 'rendered' ? 'primary' : 'neutral'"
        :variant="view === 'rendered' ? 'solid' : 'outline'"
        @click="view = 'rendered'"
      />
      <UButton
        label="Source"
        icon="i-lucide-code"
        :color="view === 'source' ? 'primary' : 'neutral'"
        :variant="view === 'source' ? 'solid' : 'outline'"
        @click="view = 'source'"
      />
    </UFieldGroup>

    <UFieldGroup size="xs">
      <UTooltip text="Copy raw file">
        <UButton
          icon="i-lucide-clipboard"
          color="neutral"
          variant="outline"
          :disabled="!content"
          aria-label="Copy raw file"
          @click="copyRaw"
        />
      </UTooltip>
      <UTooltip text="View on GitHub">
        <UButton
          icon="i-simple-icons-github"
          color="neutral"
          variant="outline"
          :to="blob(slug, path)"
          target="_blank"
          aria-label="View on GitHub"
          @click="trackSource(slug)"
        />
      </UTooltip>
      <UTooltip text="Download bundle (.zip)">
        <UButton
          icon="i-lucide-download"
          color="neutral"
          variant="outline"
          :to="`/api/skills/${slug}/download`"
          external
          aria-label="Download bundle"
          @click="trackDownload(slug, 'detail')"
        />
      </UTooltip>
    </UFieldGroup>
  </div>
</template>
