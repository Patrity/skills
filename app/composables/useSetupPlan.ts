import type { BundleFiles, CliManifest, SetupPlan } from '~~/shared/types/setup'
import type { SkillDetailResponse, SkillFileResponse, TreeNode } from '~~/shared/types/skills'
import type { BuildState } from '~~/shared/setup/build-state'
import { planFresh } from '~~/shared/setup/plan'
import { resolveBundles } from '~~/shared/setup/wizard'

const encoder = new TextEncoder()

/**
 * The three files of a bundle that change what a setup renders: its CLAUDE.md section and the two
 * settings halves (which also decide whether `.claude/settings.local.json` joins the managed
 * `.gitignore` block). Everything else a bundle ships is copied verbatim and cannot alter the plan,
 * so the preview never downloads it — the zip is built server-side from the real bytes.
 */
const PLAN_FILES = ['CLAUDE.md', 'settings.json', 'settings.local.json']

const trees = new Map<string, Promise<TreeNode[]>>()

/**
 * A bundle's file tree, fetched at most once per page: the plan needs it to know which of
 * `PLAN_FILES` the bundle actually ships (asking for one it does not would be a 404 in the
 * console), and the Files tab lists it. Failure resolves to an empty tree and is retried later.
 */
export function bundleTree(slug: string): Promise<TreeNode[]> {
  const cached = trees.get(slug)
  if (cached) return cached
  const pending = $fetch<SkillDetailResponse>(`/api/skills/${encodeURIComponent(slug)}`)
    .then(res => res.skill.tree)
    .catch(() => {
      trees.delete(slug)
      return [] as TreeNode[]
    })
  trees.set(slug, pending)
  return pending
}

/** The browser's copy of what `POST /api/build` would produce, recomputed on every edit. */
export function useSetupPlan(state: Ref<BuildState>, manifest: Ref<CliManifest | null>) {
  // slug → bundle-relative path → text, holding only the files above that the bundle actually has.
  const loaded = reactive(new Map<string, Record<string, string>>())
  const snippetsLoading = ref(false)
  const fetchWarnings = ref<string[]>([])

  const resolved = computed(() => (manifest.value ? resolveBundles(state.value.bundles, manifest.value.skills).bundles : []))

  async function load(slug: string): Promise<Record<string, string>> {
    const roots = new Set((await bundleTree(slug)).filter(n => n.type === 'file').map(n => n.path.toLowerCase()))
    const files: Record<string, string> = {}
    await Promise.all(PLAN_FILES.filter(name => roots.has(name.toLowerCase())).map(async (name) => {
      try {
        const res = await $fetch<SkillFileResponse>(`/api/skills/${encodeURIComponent(slug)}/file/${name}`)
        if (res.content !== null) files[name] = res.content
      } catch {
        fetchWarnings.value = [...fetchWarnings.value, `${slug}: could not load ${name}; the preview is missing what it contributes`]
      }
    }))
    return files
  }

  // Nothing fetches before the page is mounted: the server renders no bundle files, so flipping
  // `snippetsLoading` during client setup would make the first client render disagree with the
  // markup it is hydrating.
  const mounted = ref(false)
  onMounted(() => {
    mounted.value = true
  })

  watch([resolved, mounted], async ([slugs, ready]) => {
    // Server-side this would fetch on every ISR render for a preview only the browser shows.
    if (import.meta.server || !ready) return
    const missing = slugs.filter(s => !loaded.has(s))
    if (!missing.length) return
    snippetsLoading.value = true
    await Promise.all(missing.map(async slug => loaded.set(slug, await load(slug))))
    snippetsLoading.value = false
  }, { immediate: true })

  const plan = computed<SetupPlan | null>(() => {
    if (!manifest.value) return null
    const bundleFiles: Record<string, BundleFiles> = {}
    for (const slug of resolved.value) {
      const files: BundleFiles = {}
      for (const [path, text] of Object.entries(loaded.get(slug) ?? {})) files[path] = encoder.encode(text)
      bundleFiles[slug] = files
    }
    return planFresh({
      manifest: manifest.value,
      projectName: state.value.projectName,
      answers: state.value.answers,
      bundles: resolved.value,
      bundleFiles,
      registry: manifest.value.registry
    })
  })

  const warnings = computed(() => [...(plan.value?.warnings ?? []), ...fetchWarnings.value])

  return { plan, snippetsLoading, warnings }
}
