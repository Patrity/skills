<script setup lang="ts">
import { preloadPayload } from '#app'
import type { TreeItem } from '@nuxt/ui'
import type { TreeNode } from '~~/shared/types/skills'
import { encodePathSegments } from '~~/shared/utils/paths'

const props = defineProps<{
  tree: TreeNode[]
  selectedPath: string
  slug: string
}>()

const emit = defineEmits<{
  select: [path: string]
}>()

interface SkillTreeItem extends TreeItem {
  path: string
  nodeType: 'file' | 'dir'
  children?: SkillTreeItem[]
}

function iconFor(name: string): string {
  const lower = name.toLowerCase()
  if (lower === 'readme.md') return 'i-lucide-book-open'
  if (lower.endsWith('.md')) return 'i-lucide-file-text'
  if (lower.endsWith('.json')) return 'i-lucide-file-json'
  if (lower.endsWith('.py')) return 'i-lucide-file-code-2'
  if (lower.endsWith('.sh') || lower.endsWith('.bash')) return 'i-lucide-terminal'
  if (lower.endsWith('.yaml') || lower.endsWith('.yml')) return 'i-lucide-file-cog'
  if (lower.endsWith('.ts') || lower.endsWith('.js')) return 'i-lucide-file-code'
  return 'i-lucide-file'
}

function toItems(nodes: TreeNode[]): SkillTreeItem[] {
  return nodes.map(n => n.type === 'dir'
    ? { label: n.name, path: n.path, nodeType: 'dir' as const, children: toItems(n.children ?? []) }
    : { label: n.name, path: n.path, nodeType: 'file' as const, icon: iconFor(n.name) })
}
const items = computed(() => toItems(props.tree))

function ancestors(path: string): string[] {
  const parts = path.split('/')
  const out: string[] = []
  for (let i = 1; i < parts.length; i++) out.push(parts.slice(0, i).join('/'))
  return out
}

// UTree keys expanded nodes by `get-key` (the path). Start with the selected file's ancestors
// open and keep adding as the route changes; never collapse on the user's behalf. The desktop
// panel and the mobile slideover each mount their own SkillTree instance, so expansion is
// lifted into useState (Nuxt's SSR-safe shared state), keyed by slug, so both share it.
const expanded = useState<string[]>(`skill-tree-expanded:${props.slug}`, () => ancestors(props.selectedPath))
watch(() => props.selectedPath, (path) => {
  expanded.value = [...new Set([...expanded.value, ...ancestors(path)])]
})

function findItem(list: SkillTreeItem[], path: string): SkillTreeItem | undefined {
  for (const item of list) {
    if (item.path === path) return item
    const child = item.children && findItem(item.children, path)
    if (child) return child
  }
  return undefined
}

// v-model holds the item OBJECT (Nuxt UI v4 Tree), not a key.
const selected = computed<SkillTreeItem | undefined>({
  get: () => findItem(items.value, props.selectedPath),
  set: (item) => {
    if (item && item.nodeType === 'file' && item.path !== props.selectedPath) emit('select', item.path)
  }
})

function onSelect(e: Event) {
  // Folders toggle open/closed but must not become the selection.
  const item = (e as CustomEvent<{ value?: SkillTreeItem }>).detail?.value
  if (item?.nodeType === 'dir') e.preventDefault()
}

// Hovering a file is the earliest signal it is about to be opened, and the click then waits
// on that route's payload (an uncached one costs a cold ISR render). Fetch it early; once
// per path, because the browser caches it from then on.
const nuxtApp = useNuxtApp()
const preloaded = new Set<string>()

/**
 * Delegated so the whole row counts, not just the label glyphs. `data-slot="link"` is the row
 * element itself and never contains a nested row (children live in a sibling `ul`), so the
 * `data-tree-path` inside it always belongs to the row being hovered. Only files carry the
 * attribute, which is what keeps directories out.
 */
function onPointerOver(event: PointerEvent) {
  const row = (event.target as Element | null)?.closest?.('[data-slot="link"]')
  const path = row?.querySelector<HTMLElement>('[data-tree-path]')?.dataset.treePath
  if (!path || preloaded.has(path)) return
  preloaded.add(path)
  // preloadPayload reads the Nuxt app off the context, which a DOM handler is outside of.
  const url = `/skill/${encodeURIComponent(props.slug)}/${encodePathSegments(path)}`
  void nuxtApp.runWithContext(() => preloadPayload(url).catch(() => {}))
}
</script>

<template>
  <UTree
    v-model="selected"
    v-model:expanded="expanded"
    :items="items"
    :get-key="(item: SkillTreeItem) => item.path"
    size="sm"
    class="p-2"
    @select="onSelect"
    @pointerover="onPointerOver"
  >
    <template #item-label="{ item }">
      <!-- Plain inline span: a block child here would break the label's truncation. The
           attribute is what onPointerOver maps a hovered row back to. -->
      <span :data-tree-path="item.nodeType === 'file' ? item.path : undefined">{{ item.label }}</span>
    </template>
  </UTree>
</template>
