<script setup lang="ts">
import type { SetupPlan } from '~~/shared/types/setup'
import type { MarkdownBody, MarkdownRender } from '~~/shared/types/skills'

const props = withDefaults(defineProps<{
  plan: SetupPlan | null
  warnings: string[]
  /** True while the bundle snippets the preview is composed from are still arriving. */
  loading: boolean
  bundles: string[]
  /** The zip's name is built from it, so the footer line can name the file you get. */
  projectName: string
  /** False disables the download: the same check `/api/build` would fail on. */
  valid: boolean
  downloading: boolean
  /**
   * `panel` is the sticky column on `lg`: its own view switch and the action footer.
   * `sheet` is the body inside the mobile bottom sheet, which carries both itself.
   */
  variant?: 'panel' | 'sheet'
}>(), { variant: 'panel' })

const emit = defineEmits<{ download: [], copyCli: [], copyShare: [], copyMarkdown: [] }>()

const view = defineModel<'claude' | 'files'>('view', { required: true })
const rendered = defineModel<boolean>('rendered', { required: true })
/** Filled by the file tree, which is the only thing that knows what every bundle ships. */
const fileCount = defineModel<number>('fileCount', { default: 0 })

const RENDER_DEBOUNCE_MS = 400

const VIEWS = [
  { value: 'claude' as const, label: 'CLAUDE.md' },
  { value: 'files' as const, label: 'Files' }
]

const markdown = computed(() => props.plan?.claudeMd.content ?? '')

const body = ref<MarkdownBody | null>(null)
const renderLoading = ref(false)

let timer: ReturnType<typeof setTimeout> | null = null
// Only the newest request may write `body`: the debounce still lets a slow render land after a
// faster later one.
let ticket = 0

watch([markdown, rendered], ([text, on]) => {
  if (!import.meta.client) return
  if (timer) clearTimeout(timer)
  if (!on || !text) return
  const mine = ++ticket
  renderLoading.value = true
  timer = setTimeout(async () => {
    try {
      const res = await $fetch<MarkdownRender>('/api/build/render', { method: 'POST', body: { markdown: text } })
      if (mine !== ticket) return
      body.value = res.body
    } catch {
      // The source view below is the fallback; a failed render must not blank the tab.
      if (mine === ticket) body.value = null
    } finally {
      if (mine === ticket) renderLoading.value = false
    }
  }, RENDER_DEBOUNCE_MS)
}, { immediate: true })

onScopeDispose(() => {
  if (timer) clearTimeout(timer)
})

/**
 * The page owns its heading ("Answer the questions.."), so the previewed document's
 * `# <project>` is demoted to an `h2`: a preview pane must not put a second top-level
 * heading on the page.
 */
const previewBody = computed<MarkdownBody | null>(() => {
  const root = body.value
  if (!root) return null
  return {
    ...root,
    children: root.children.map(node => (node.type === 'element' && node.tag === 'h1' ? { ...node, tag: 'h2' } : node))
  }
})

const count = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

/** The mono line above the content: what this pane is showing, and how big it is. */
const headline = computed(() => [
  view.value === 'claude' ? 'CLAUDE.md' : 'Files',
  count(props.bundles.length, 'bundle'),
  count(fileCount.value, 'file')
].join(' · '))

const zipLine = computed(() => `${props.projectName}-claude-setup.zip · ${count(fileCount.value, 'file')} · unzips straight into an empty project root`)
</script>

<template>
  <div class="flex min-h-0 min-w-0 flex-col">
    <div class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-default bg-elevated">
      <div
        class="flex items-center gap-3 border-b border-default px-3 py-2.5"
        :class="variant === 'panel' ? 'justify-between' : 'justify-end'"
      >
        <SegmentedControl
          v-if="variant === 'panel'"
          v-model="view"
          :items="VIEWS"
          label="Preview"
        />
        <USwitch
          v-model="rendered"
          label="Rendered"
          :ui="{ label: 'text-[0.8125rem] text-muted' }"
        />
      </div>

      <div class="min-h-0 flex-1 overflow-y-auto">
        <Callout
          v-if="warnings.length"
          tone="warning"
          icon="i-lucide-triangle-alert"
          :title="count(warnings.length, 'warning')"
          class="m-3"
        >
          <ul class="m-0 mt-1.5 list-disc ps-4 text-[0.8125rem]/[1.6] text-muted">
            <li
              v-for="warning in warnings"
              :key="warning"
            >
              {{ warning }}
            </li>
          </ul>
        </Callout>

        <div class="flex items-center justify-between gap-2 border-b border-default px-3 py-2">
          <span class="truncate font-mono text-[0.8125rem] text-default">{{ headline }}</span>
          <span
            v-if="loading || renderLoading"
            class="shrink-0 font-mono text-[0.6875rem] text-dimmed"
          >Working..</span>
          <UTooltip
            v-else-if="view === 'claude'"
            text="Copy the CLAUDE.md"
          >
            <button
              type="button"
              class="-me-1 inline-flex shrink-0 cursor-pointer rounded-md p-1 text-dimmed transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              aria-label="Copy the composed CLAUDE.md"
              @click="emit('copyMarkdown')"
            >
              <UIcon
                name="i-lucide-copy"
                class="size-3.5"
              />
            </button>
          </UTooltip>
        </div>

        <!-- v-show, not v-if: switching views must not throw away the editor, refetch the
             bundle trees, or lose the file count the footer line reads. -->
        <div
          v-show="view === 'claude'"
          class="min-w-0"
        >
          <div
            v-if="!plan || (rendered && renderLoading && !body)"
            class="space-y-3 p-3"
          >
            <div class="h-4 w-1/3 animate-pulse rounded-md bg-(--ui-border)" />
            <div class="h-4 w-full animate-pulse rounded-md bg-(--ui-border)" />
            <div class="h-4 w-5/6 animate-pulse rounded-md bg-(--ui-border)" />
          </div>
          <div
            v-else-if="rendered && previewBody"
            class="docs-in-pane p-4"
          >
            <MarkdownView :body="previewBody" />
          </div>
          <CodeView
            v-else
            :code="markdown"
            language="markdown"
          />
        </div>

        <div
          v-show="view === 'files'"
          class="min-w-0"
        >
          <div
            v-if="!plan"
            class="space-y-3 p-3"
          >
            <div class="h-4 w-1/3 animate-pulse rounded-md bg-(--ui-border)" />
            <div class="h-4 w-2/3 animate-pulse rounded-md bg-(--ui-border)" />
          </div>
          <BuildFilesTree
            v-else
            :plan="plan"
            :bundles="bundles"
            @update:count="fileCount = $event"
          />
        </div>
      </div>

      <div
        v-if="variant === 'panel'"
        class="flex flex-wrap items-center justify-between gap-3 border-t border-default p-3"
      >
        <UButton
          data-build-download
          label="Download setup"
          icon="i-lucide-download"
          class="glow"
          :loading="downloading"
          :disabled="!valid"
          @click="emit('download')"
        />
        <div class="flex gap-2">
          <UButton
            label="Share link"
            icon="i-lucide-link"
            color="neutral"
            variant="outline"
            size="sm"
            @click="emit('copyShare')"
          />
          <UButton
            label="CLI command"
            icon="i-lucide-terminal"
            color="neutral"
            variant="outline"
            size="sm"
            @click="emit('copyCli')"
          />
        </div>
      </div>
    </div>

    <p
      v-if="variant === 'panel'"
      class="mt-3 font-mono text-[0.6875rem]/[1.5] text-dimmed"
    >
      {{ zipLine }}
    </p>
  </div>
</template>

<style scoped>
/* The rendered CLAUDE.md is a preview inside a pane, not a page: it keeps the reading
   rhythm but none of the display sizes. */
.docs-in-pane :deep(h2) {
  margin: 1.25rem 0 0.5rem;
  font-family: var(--font-teko);
  font-size: 26px;
  font-weight: 600;
  line-height: 1;
  color: var(--ui-text);
}

.docs-in-pane :deep(h2:first-child) {
  margin-top: 0;
}

.docs-in-pane :deep(p),
.docs-in-pane :deep(ul),
.docs-in-pane :deep(ol) {
  margin: 0 0 0.75rem;
  font-size: 0.875rem;
  line-height: 1.7;
  color: var(--ui-text-muted);
}

.docs-in-pane :deep(:not(pre) > code) {
  padding: 0;
  border: 0;
  background: none;
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  color: var(--ui-text);
}
</style>
