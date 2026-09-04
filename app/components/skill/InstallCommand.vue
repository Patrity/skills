<script setup lang="ts">
const props = defineProps<{ command: string, slug: string }>()

const toast = useToast()
const { trackInstallCopy } = useAnalytics()

async function copy() {
  // navigator.clipboard is undefined outside a secure context and writeText() rejects when
  // the permission is denied — neither should surface as an unhandled rejection.
  try {
    await navigator.clipboard.writeText(props.command)
  } catch {
    toast.add({ title: 'Could not copy — select the command and copy it manually', icon: 'i-lucide-clipboard-x', color: 'error' })
    return
  }
  toast.add({ title: 'Command copied', icon: 'i-lucide-clipboard-check', color: 'success' })
  trackInstallCopy(props.slug)
}
</script>

<template>
  <div class="flex items-center gap-2 min-w-0 rounded-md border border-default bg-muted px-3 py-1.5">
    <code class="text-xs font-mono text-default truncate flex-1">{{ command }}</code>
    <UButton
      icon="i-lucide-copy"
      size="xs"
      color="neutral"
      variant="ghost"
      aria-label="Copy install command"
      class="shrink-0"
      @click.stop="copy"
    />
  </div>
</template>
