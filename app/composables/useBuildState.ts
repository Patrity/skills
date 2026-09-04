import type { BaseAxis, CliManifest } from '~~/shared/types/setup'
import type { BuildState } from '~~/shared/setup/build-state'
import { DEFAULT_PROJECT_NAME, PROJECT_NAME_RE, decodeBuildState, encodeBuildState } from '~~/shared/setup/build-state'
import { activeAxes } from '~~/shared/setup/contributions'
import { applyProfile, defaultAnswers, preselectedBundles, resolveBundles, validateAnswers } from '~~/shared/setup/wizard'

/** The preset radio's value when no profile is chosen; never a profile name (profiles are slugs). */
export const CUSTOM_PRESET = 'custom'

const HASH_DEBOUNCE_MS = 150

/**
 * The whole of the `/build` page's state, and the URL it round-trips through.
 *
 * SSR-safe by construction: the state is seeded from the manifest alone (the same value the server
 * renders), and `location.hash` is only read once mounted — so a shared link is applied as a normal
 * post-hydration update rather than as a mismatch.
 */
export function useBuildState(manifest: Ref<CliManifest | null>) {
  const toast = useToast()
  const state = ref<BuildState>({ profile: null, projectName: DEFAULT_PROJECT_NAME, answers: {}, bundles: [] })
  /** False until the hash has been read: writing before that would clobber the incoming link. */
  const hashApplied = ref(false)

  let seeded = false
  watch(manifest, (m) => {
    if (!m || seeded) return
    seeded = true
    state.value = decodeBuildState('', m).state
  }, { immediate: true })

  function applyHash(m: CliManifest) {
    const hash = window.location.hash
    if (hash.length > 1) {
      const { state: decoded, warnings } = decodeBuildState(hash, m)
      state.value = decoded
      if (warnings.length) {
        toast.add({
          title: 'Some of the shared link could not be applied',
          description: warnings.join(' · '),
          icon: 'i-lucide-triangle-alert',
          color: 'warning'
        })
      }
    }
    hashApplied.value = true
  }

  onMounted(() => {
    if (manifest.value) return applyHash(manifest.value)
    const stop = watch(manifest, (m) => {
      if (!m) return
      stop()
      applyHash(m)
    })
  })

  let timer: ReturnType<typeof setTimeout> | null = null
  watch(state, (s) => {
    if (!import.meta.client || !hashApplied.value) return
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      // `history.state` is preserved: Vue Router keeps its scroll/position bookkeeping there and
      // replacing it with null breaks back-navigation.
      window.history.replaceState(window.history.state, '', `#${encodeBuildState(s)}`)
    }, HASH_DEBOUNCE_MS)
  }, { deep: true })

  onScopeDispose(() => {
    if (timer) clearTimeout(timer)
  })

  const base = computed(() => manifest.value?.base ?? null)
  const skills = computed(() => manifest.value?.skills ?? [])
  const profile = computed(() => manifest.value?.profiles.find(p => p.name === state.value.profile))

  /** Only the axes the wizard would ask, given the answers so far. */
  const axes = computed<BaseAxis[]>(() => (base.value ? activeAxes(base.value, state.value.answers) : []))

  /** What the wizard would pre-tick right now — the "recommended" marker on the picker. */
  const recommended = computed(() => (base.value ? preselectedBundles(base.value, state.value.answers, profile.value, skills.value) : []))

  /** slug → the ticked bundles that depend on it, so unticking it can be refused with a reason. */
  const lockedBy = computed<Record<string, string[]>>(() => {
    const out: Record<string, string[]> = {}
    for (const slug of state.value.bundles) {
      for (const dep of resolveBundles([slug], skills.value).bundles) {
        if (dep === slug) continue
        ;(out[dep] ??= []).push(slug)
      }
    }
    return out
  })

  /** A hand edit means the state is no longer the profile's: the preset falls back to Custom. */
  function edit(patch: Partial<BuildState>) {
    state.value = { ...state.value, profile: null, ...patch }
  }

  function setProjectName(name: string) {
    // Not a profile-owned field, so this one does not flip the preset.
    state.value = { ...state.value, projectName: name }
  }

  function setAnswer(id: string, value: string) {
    // Answers of axes that stop being active are kept, not deleted: flipping back restores them,
    // and `activeAxes` is what decides which ones the render actually reads.
    edit({ answers: { ...state.value.answers, [id]: value } })
  }

  function toggleBundle(slug: string) {
    const selected = state.value.bundles
    if (!selected.includes(slug)) {
      edit({ bundles: resolveBundles([...selected, slug], skills.value).bundles })
      return
    }
    const required = lockedBy.value[slug]
    if (required?.length) {
      toast.add({
        title: `${slug} stays selected`,
        description: `It is required by ${required.join(', ')}.`,
        icon: 'i-lucide-lock',
        color: 'warning'
      })
      return
    }
    edit({ bundles: selected.filter(s => s !== slug) })
  }

  function selectPreset(name: string) {
    const m = manifest.value
    if (!m?.base) return
    const prof = name === CUSTOM_PRESET ? undefined : m.profiles.find(p => p.name === name)
    const answers = applyProfile(m.base, prof, defaultAnswers(m.base))
    state.value = {
      profile: prof?.name ?? null,
      projectName: state.value.projectName,
      answers,
      bundles: resolveBundles(preselectedBundles(m.base, answers, prof, m.skills), m.skills).bundles
    }
  }

  const preset = computed<string>({
    get: () => state.value.profile ?? CUSTOM_PRESET,
    set: selectPreset
  })

  const nameError = computed(() => (PROJECT_NAME_RE.test(state.value.projectName)
    ? null
    : 'Start with a letter or digit; letters, digits, dot, dash and underscore only (max 64).'))

  // The same check `/api/build` runs; unreachable through the UI (every answer comes from the
  // schema's own options) but it keeps the download disabled rather than sending a 400.
  const answerErrors = computed(() => (base.value ? validateAnswers(base.value, state.value.answers) : []))
  const valid = computed(() => !nameError.value && !answerErrors.value.length)

  return { state, preset, axes, recommended, lockedBy, valid, nameError, setProjectName, setAnswer, toggleBundle, selectPreset }
}
