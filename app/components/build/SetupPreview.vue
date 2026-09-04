<script setup lang="ts">
import type { SetupPlan } from '~~/shared/types/setup'
import type { MarkdownBody, MarkdownRender } from '~~/shared/types/skills'

const props = defineProps<{
  plan: SetupPlan | null
  warnings: string[]
  /** True while the bundle snippets the preview is composed from are still arriving. */
  loading: boolean
  bundles: string[]
}>()

const RENDER_DEBOUNCE_MS = 400

const tabs = [
  { label: 'CLAUDE.md', value: 'claude', slot: 'claude' as const, icon: 'i-lucide-file-text' },
  { label: 'Files', value: 'files', slot: 'files' as const, icon: 'i-lucide-folder-tree' }
]
const tab = ref('claude')

const markdown = computed(() => props.plan?.claudeMd.content ?? '')

const rendered = ref(false)
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
 * The page's own `<h1>` is the navbar title, so the previewed document's `# <project>` is demoted
 * to an `<h2>`: a preview pane must not put a second top-level heading on the page.
 */
const previewBody = computed<MarkdownBody | null>(() => {
  const root = body.value
  if (!root) return null
  return {
    ...root,
    children: root.children.map(node => (node.type === 'element' && node.tag === 'h1' ? { ...node, tag: 'h2' } : node))
  }
})
</script>

<template>
  <div class="space-y-3 min-w-0">
    <UAlert
      v-if="warnings.length"
      color="warning"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      :title="warnings.length === 1 ? '1 warning' : `${warnings.length} warnings`"
    >
      <template #description>
        <ul class="list-disc ps-4 space-y-0.5">
          <li
            v-for="warning in warnings"
            :key="warning"
          >
            {{ warning }}
          </li>
        </ul>
      </template>
    </UAlert>

    <UTabs
      v-model="tab"
      :items="tabs"
      :content="true"
      size="sm"
      :ui="{ content: 'min-w-0' }"
    >
      <template #claude>
        <div class="space-y-2 min-w-0">
          <div class="flex items-center justify-between gap-2">
            <USwitch
              v-model="rendered"
              label="Rendered"
            />
            <span
              v-if="renderLoading"
              class="text-xs text-dimmed"
            >Rendering…</span>
          </div>
          <UProgress
            v-if="loading"
            size="sm"
          />
          <USkeleton
            v-if="!plan"
            class="h-64 w-full"
          />
          <USkeleton
            v-else-if="rendered && renderLoading && !body"
            class="h-64 w-full"
          />
          <MarkdownView
            v-else-if="rendered && previewBody"
            :body="previewBody"
          />
          <CodeView
            v-else
            :code="markdown"
            language="markdown"
          />
        </div>
      </template>

      <template #files>
        <div class="space-y-2 min-w-0">
          <UProgress
            v-if="loading"
            size="sm"
          />
          <USkeleton
            v-if="!plan"
            class="h-64 w-full"
          />
          <BuildFilesTree
            v-else
            :plan="plan"
            :bundles="bundles"
          />
        </div>
      </template>
    </UTabs>
  </div>
</template>
