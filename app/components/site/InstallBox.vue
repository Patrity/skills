<script setup lang="ts">
const props = withDefaults(defineProps<{
  /** The command to show and copy. */
  command: string
  /** Bundle slug (or `init` for the setup command) — the analytics dimension. */
  slug: string
  /**
   * Show the word next to the glyph. It is hidden below `sm` either way (a phone has no
   * room for it beside the command) but never dropped from the accessible name.
   */
  label?: boolean
  /**
   * `box` is the `$ command [Copy]` plate.
   * `icon` is the bare glyph button from a bundle row's action cluster.
   */
  variant?: 'box' | 'icon'
}>(), { label: true, variant: 'box' })

const emit = defineEmits<{ copied: [slug: string] }>()

const toast = useToast()
const { trackInstallCopy } = useAnalytics()

const done = ref(false)
let resetTimer: ReturnType<typeof setTimeout> | undefined

function clearDone() {
  done.value = false
}

async function copy() {
  // navigator.clipboard is undefined outside a secure context and writeText() rejects when
  // the permission is denied — neither should surface as an unhandled rejection.
  try {
    await navigator.clipboard.writeText(props.command)
  } catch {
    toast.add({ title: 'Could not copy .. select the command and copy it manually', icon: 'i-lucide-clipboard-x', color: 'error' })
    return
  }
  toast.add({ title: 'Command copied', icon: 'i-lucide-clipboard-check', color: 'success' })
  trackInstallCopy(props.slug)
  done.value = true
  clearTimeout(resetTimer)
  resetTimer = setTimeout(clearDone, 2000)
  emit('copied', props.slug)
}

onBeforeUnmount(() => clearTimeout(resetTimer))
</script>

<template>
  <UTooltip
    v-if="variant === 'icon'"
    :text="command"
  >
    <button
      type="button"
      class="inline-flex rounded-md border border-default bg-elevated p-[0.4375rem] text-muted transition-colors cursor-pointer hover:border-primary/45 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      :class="{ 'text-primary': done }"
      :aria-label="`Copy install command: ${command}`"
      @click.stop="copy"
    >
      <UIcon
        :name="done ? 'i-lucide-check' : 'i-lucide-copy'"
        class="size-4"
      />
    </button>
  </UTooltip>

  <!--
    The whole box is the click target (approved install-box card), so it is one button.
    No aria-label: the name is built from the contents, so it always contains the visible
    text (Lighthouse `label-content-name-mismatch`) and still says "Copy" when the word
    itself is only there for a screen reader.
  -->
  <button
    v-else
    type="button"
    class="install w-full"
    @click.stop="copy"
  >
    <span class="line">
      <span
        class="prompt"
        aria-hidden="true"
      >$</span>
      <code class="cmd">{{ command }}</code>
    </span>
    <span
      class="copy"
      :class="{ 'is-done': done }"
    >
      <UIcon
        :name="done ? 'i-lucide-check' : 'i-lucide-copy'"
        class="size-3.5 shrink-0"
      />
      <span :class="label ? 'sr-only sm:not-sr-only' : 'sr-only'">{{ done ? 'Copied' : 'Copy' }}</span>
    </span>
  </button>
</template>

<style scoped>
/* docs/design/previews/_shared/tokens.css (.install) + components/install-box.html. */
.install {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.625rem 0.875rem;
  border: 1px solid var(--ui-border);
  border-radius: 0.5rem;
  background: var(--ui-bg-elevated);
  font-family: var(--font-mono);
  font-size: 0.875rem;
  text-align: left;
  cursor: pointer;
}

.install:hover {
  border-color: color-mix(in srgb, var(--color-green-500) 40%, transparent);
}

.install:focus-visible {
  outline: 2px solid var(--color-green-500);
  outline-offset: 2px;
}

.line {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
}

.prompt {
  color: var(--color-green-500);
  user-select: none;
}

.cmd {
  overflow: hidden;
  color: var(--ui-text);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.copy {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  flex: none;
  margin: -0.25rem -0.375rem -0.25rem 0;
  padding: 0.25rem 0.5rem;
  border-radius: 0.375rem;
  font-size: 0.75rem;
  color: var(--ui-text-dimmed);
}

.install:hover .copy {
  color: var(--color-green-400);
  background: color-mix(in srgb, var(--color-green-500) 10%, transparent);
}

.copy.is-done {
  color: var(--color-green-400);
}
</style>
