<script setup lang="ts">
import type { TreeItem } from '@nuxt/ui'
import type { SetupPlan } from '~~/shared/types/setup'
import type { TreeNode } from '~~/shared/types/skills'
import { ENV_EXAMPLE_PATH } from '~~/shared/setup/env-example'
import { serializeLockfile } from '~~/shared/setup/lock'
import { isSafeBundlePath } from '~~/shared/setup/paths'
import { formatBytes } from '~~/shared/utils/format'

const props = defineProps<{
  plan: SetupPlan
  /** Bundle slugs, already resolved through `dependsOn`. */
  bundles: string[]
}>()

// `bundleTree` is the page-wide cache the plan already fills, so listing the files costs no
// request of its own and ticking a bundle off and on again costs nothing.
const trees = reactive(new Map<string, TreeNode[]>())
const loading = ref(false)

// Deferred to `mounted` for the same reason as the snippets: flipping `loading` during client
// setup would make the first client render disagree with the server's markup.
const mounted = ref(false)
onMounted(() => {
  mounted.value = true
})

watch([() => props.bundles, mounted], async ([slugs, ready]) => {
  // The browser is the only place this preview renders; SSR would pay for it on every ISR miss.
  if (import.meta.server || !ready) return
  const missing = slugs.filter(s => !trees.has(s))
  if (!missing.length) return
  loading.value = true
  // A bundle whose tree cannot be read still contributes its CLAUDE.md section; only its files
  // are missing from this list.
  await Promise.all(missing.map(async slug => trees.set(slug, await bundleTree(slug))))
  loading.value = false
}, { immediate: true })

const encoder = new TextEncoder()
const byteLength = (text: string) => encoder.encode(text).byteLength

// What `planFresh` never writes out of a bundle: the two settings files are merged instead, and
// README/CLAUDE.md are the registry's own metadata.
const SKIPPED = new Set(['readme.md', 'claude.md', 'settings.json', 'settings.local.json'])

interface Entry { path: string, size?: number }

function flatten(nodes: TreeNode[], out: TreeNode[] = []): TreeNode[] {
  for (const node of nodes) {
    if (node.type === 'file') out.push(node)
    if (node.children) flatten(node.children, out)
  }
  return out
}

const entries = computed<Entry[]>(() => {
  const sizes = new Map<string, number | undefined>()
  for (const file of props.plan.files) sizes.set(file.path, file.bytes.byteLength)
  for (const slug of props.bundles) {
    for (const node of flatten(trees.get(slug) ?? [])) {
      if (SKIPPED.has(node.path.toLowerCase()) || !isSafeBundlePath(node.path)) continue
      sizes.set(`.claude/${node.path}`, node.size)
    }
  }
  sizes.set('CLAUDE.md', byteLength(props.plan.claudeMd.content))
  if (props.plan.settings) sizes.set('.claude/settings.json', byteLength(props.plan.settings.content))
  if (props.plan.settingsLocal) sizes.set('.claude/settings.local.json', byteLength(props.plan.settingsLocal.content))
  if (props.plan.gitignore) sizes.set('.gitignore', byteLength(props.plan.gitignore.content))
  if (props.plan.envExample) sizes.set(ENV_EXAMPLE_PATH, byteLength(props.plan.envExample.content))
  // Sizeless: the browser's lockfile has no per-file hashes, so its length is not the real one.
  sizes.set('.claude/skills.lock.json', undefined)
  return [...sizes.entries()]
    .map(([path, size]) => ({ path, size }))
    .sort((a, b) => a.path.localeCompare(b.path))
})

const totalBytes = computed(() => entries.value.reduce((n, e) => n + (e.size ?? 0), 0))
const lockSize = computed(() => byteLength(serializeLockfile(props.plan.lock)))

interface FileTreeItem extends TreeItem {
  path: string
  nodeType: 'file' | 'dir'
  size?: number
  children?: FileTreeItem[]
}

function iconFor(path: string): string {
  const lower = path.toLowerCase()
  if (lower.startsWith('.claude/hooks/')) return 'i-lucide-terminal'
  if (lower.endsWith('.md')) return 'i-lucide-file-text'
  if (lower.endsWith('.json')) return 'i-lucide-file-json'
  if (lower.endsWith('.yaml') || lower.endsWith('.yml')) return 'i-lucide-file-cog'
  if (lower.endsWith('.sh') || lower.endsWith('.bash')) return 'i-lucide-terminal'
  if (lower.endsWith('.py')) return 'i-lucide-file-code-2'
  if (lower.endsWith('.ts') || lower.endsWith('.js')) return 'i-lucide-file-code'
  return 'i-lucide-file'
}

function sortItems(list: FileTreeItem[]): FileTreeItem[] {
  list.sort((a, b) => (a.nodeType === b.nodeType
    ? String(a.label).localeCompare(String(b.label))
    : a.nodeType === 'dir' ? -1 : 1))
  for (const item of list) if (item.children) sortItems(item.children)
  return list
}

const items = computed<FileTreeItem[]>(() => {
  const roots: FileTreeItem[] = []
  const dirs = new Map<string, FileTreeItem>()
  for (const entry of entries.value) {
    const parts = entry.path.split('/')
    let siblings = roots
    let prefix = ''
    for (const segment of parts.slice(0, -1)) {
      prefix = prefix ? `${prefix}/${segment}` : segment
      let dir = dirs.get(prefix)
      if (!dir) {
        dir = { label: segment, path: prefix, nodeType: 'dir', children: [] }
        dirs.set(prefix, dir)
        siblings.push(dir)
      }
      siblings = dir.children!
    }
    siblings.push({
      label: parts.at(-1)!,
      path: entry.path,
      nodeType: 'file',
      icon: iconFor(entry.path),
      size: entry.size
    })
  }
  return sortItems(roots)
})

// UTree keys expanded nodes by `get-key` (the path). The top two levels open by default; deeper
// ones stay closed, and nothing the user opened is ever collapsed for them.
const expanded = ref<string[]>([])
watch(items, () => {
  const shallow: string[] = []
  const collect = (list: FileTreeItem[]) => {
    for (const item of list) {
      if (item.nodeType !== 'dir') continue
      if (item.path.split('/').length <= 2) shallow.push(item.path)
      if (item.children) collect(item.children)
    }
  }
  collect(items.value)
  expanded.value = [...new Set([...expanded.value, ...shallow])]
}, { immediate: true })
</script>

<template>
  <div class="min-w-0">
    <div class="flex items-center gap-2 px-2 pb-2 text-xs text-dimmed">
      <span>{{ entries.length }} files</span>
      <span aria-hidden="true">·</span>
      <span>{{ formatBytes(totalBytes + lockSize) }} unpacked</span>
      <UIcon
        v-if="loading"
        name="i-lucide-loader-circle"
        class="animate-spin size-3.5"
      />
    </div>
    <UTree
      v-model:expanded="expanded"
      :items="items"
      :get-key="(item: FileTreeItem) => item.path"
      size="sm"
      class="p-2 overflow-x-auto"
    >
      <template #item-label="{ item }">
        <span class="truncate">{{ item.label }}</span>
        <span
          v-if="item.size !== undefined"
          class="ms-2 text-xs text-dimmed tabular-nums"
        >{{ formatBytes(item.size) }}</span>
      </template>
    </UTree>
  </div>
</template>
