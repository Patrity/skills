<script setup lang="ts">
import type { CliManifest } from '~~/shared/types/setup'
import { resolveBundles } from '~~/shared/setup/wizard'
import { cliCommand, encodeBuildState } from '~~/shared/setup/build-state'
import { CUSTOM_PRESET } from '~/composables/useBuildState'

// Same rule as the other pages: an upstream failure stays a 5xx so ISR keeps serving the last
// good copy instead of pinning an empty builder for the cache window.
const { data: manifest, error } = await useFetch<CliManifest>('/api/cli/manifest', { key: 'cli:manifest' })
if (error.value) {
  throw createError({
    statusCode: error.value.statusCode ?? 500,
    statusMessage: 'The setup manifest is temporarily unavailable',
    fatal: true
  })
}

// `useFetch` hands back `undefined` before the first response; the composables want a settled
// `null` for "no manifest yet".
const cliManifest = computed(() => manifest.value ?? null)

const { state, preset, axes, recommended, lockedBy, valid, nameError, setProjectName, setAnswer, toggleBundle, selectPreset } = useBuildState(cliManifest)
const { plan, snippetsLoading, warnings } = useSetupPlan(state, cliManifest)

const schemaErrors = computed(() => manifest.value?.errors ?? [])
const resolvedBundles = computed(() => (manifest.value ? resolveBundles(state.value.bundles, manifest.value.skills).bundles : []))

const count = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`
const countLabel = computed(() => [
  count(manifest.value?.base?.axes.length ?? 0, 'question'),
  count(manifest.value?.skills.length ?? 0, 'bundle'),
  count(manifest.value?.profiles.length ?? 0, 'preset')
].join(' · '))

/** Shared by the sticky column and the bottom sheet, so switching between them keeps the view. */
const view = ref<'claude' | 'files'>('claude')
const rendered = ref(false)
const fileCount = ref(0)
const sheetOpen = ref(false)

/**
 * The preview is a sticky column on `lg` and a bottom sheet below it. Only one of the two is
 * mounted: two would put two download buttons on the page, run the markdown render twice and
 * keep a second CodeMirror alive behind `display: none`. SSR renders the column (which CSS
 * hides below `lg` anyway), and the first client tick corrects it, never a hydration mismatch.
 */
const isDesktop = ref(true)
let viewport: MediaQueryList | undefined

function syncViewport() {
  isDesktop.value = viewport?.matches ?? true
  if (isDesktop.value) sheetOpen.value = false
}

onMounted(() => {
  viewport = window.matchMedia('(min-width: 1024px)')
  syncViewport()
  viewport.addEventListener('change', syncViewport)
})
onBeforeUnmount(() => viewport?.removeEventListener('change', syncViewport))

// The sheet is fixed over the end of the page, so the document grows by its height while it
// is mounted; without this its last rows sit under the bar.
useHead({ bodyAttrs: { style: () => (isDesktop.value ? undefined : 'padding-bottom:9rem') } })

const toast = useToast()
const { trackBuildDownload, trackBuildCopyCli } = useAnalytics()

const command = computed(() => (manifest.value ? cliCommand(state.value, manifest.value) : ''))
const analyticsProfile = computed(() => state.value.profile ?? CUSTOM_PRESET)

/** A 400 from `/api/build` carries `{ statusMessage }`; with `responseType: 'blob'` it arrives as a Blob. */
async function messageFor(e: unknown): Promise<string> {
  const err = e as { statusMessage?: string, message?: string, data?: unknown }
  const read = (value: unknown): string | null => {
    if (!value || typeof value !== 'object') return null
    const message = (value as { statusMessage?: unknown, message?: unknown }).statusMessage
      ?? (value as { message?: unknown }).message
    return typeof message === 'string' ? message : null
  }
  if (err.data instanceof Blob) {
    try {
      return read(JSON.parse(await err.data.text())) ?? err.message ?? 'Unknown error'
    } catch {
      // Not JSON: fall through to the fetch error's own message.
    }
  }
  return read(err.data) ?? err.statusMessage ?? err.message ?? 'Unknown error'
}

const downloading = ref(false)

async function download() {
  // `:loading` disables the button while the zip is built, and a disabled button drops focus
  // to <body>: a keyboard user would restart the whole tab order after every download.
  const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null
  downloading.value = true
  try {
    const blob = await $fetch<Blob>('/api/build', {
      method: 'POST',
      body: { projectName: state.value.projectName, answers: state.value.answers, bundles: state.value.bundles },
      responseType: 'blob'
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${state.value.projectName}-claude-setup.zip`
    document.body.appendChild(link)
    link.click()
    link.remove()
    // Revoking synchronously cancels the download in Safari; one tick is enough.
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    trackBuildDownload(analyticsProfile.value, state.value.bundles, state.value.answers)
  } catch (e) {
    toast.add({ title: 'Could not build the zip', description: await messageFor(e), icon: 'i-lucide-triangle-alert', color: 'error' })
  } finally {
    downloading.value = false
    await nextTick()
    if (trigger?.isConnected) trigger.focus()
  }
}

async function copy(text: string, title: string): Promise<boolean> {
  // navigator.clipboard is undefined outside a secure context and writeText() rejects when the
  // permission is denied: neither should surface as an unhandled rejection.
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    toast.add({ title: 'The browser blocked the copy. Select the text and copy it by hand.', icon: 'i-lucide-clipboard-x', color: 'error' })
    return false
  }
  toast.add({ title, icon: 'i-lucide-clipboard-check', color: 'success' })
  return true
}

async function copyCli() {
  if (await copy(command.value, 'CLI command copied')) trackBuildCopyCli(analyticsProfile.value)
}

async function copyShareLink() {
  // Built from the state rather than read off `location`, which the debounced hash write may
  // not have caught up with yet.
  await copy(`${window.location.origin}${window.location.pathname}#${encodeBuildState(state.value)}`, 'Share link copied')
}

async function copyMarkdown() {
  await copy(plan.value?.claudeMd.content ?? '', 'CLAUDE.md copied')
}

const sheetSummary = computed(() => `${view.value === 'claude' ? 'CLAUDE.md' : 'Files'} · ${count(resolvedBundles.value.length, 'bundle')}`)

const description = 'Compose a Claude Code setup in the browser. Pick a preset, answer the questions, tick the bundles, then take the zip or the CLI command that reproduces it.'
const { public: { siteUrl } } = useRuntimeConfig()

useSiteSeo({
  title: 'Build your setup',
  description,
  ogUrl: `${siteUrl.replace(/\/+$/, '')}/build`
})
</script>

<template>
  <div>
    <section class="relative overflow-hidden border-b border-default">
      <div
        class="hive-texture absolute inset-0 opacity-40"
        aria-hidden="true"
      />
      <div class="relative mx-auto max-w-7xl px-4 pt-8 pb-6 sm:px-6 lg:pt-14 lg:pb-10">
        <MicroLabel class="mb-2.5 block">
          {{ countLabel }}
        </MicroLabel>
        <h1 class="m-0 font-teko text-[40px] font-semibold leading-[.9] tracking-[-0.015em] text-default lg:text-[64px]">
          Answer the questions. <span class="text-primary">Take the zip.</span>
        </h1>
        <p class="mt-3.5 max-w-[44rem] text-base/[1.65] text-muted">
          Nothing is stored here. The whole form lives in the URL hash, so the share link is the only memory this site has.
        </p>
      </div>
    </section>

    <div class="mx-auto max-w-7xl px-4 pt-6 pb-12 sm:px-6 lg:pt-10 lg:pb-20">
      <Callout
        v-if="schemaErrors.length"
        tone="error"
        icon="i-lucide-octagon-alert"
        title="The base schema has errors"
        description="The builder stays disabled until they are fixed."
      >
        <ul class="m-0 mt-2 list-disc ps-4 text-[0.9375rem]/[1.6] text-muted">
          <li
            v-for="message in schemaErrors"
            :key="message"
          >
            {{ message }}
          </li>
        </ul>
      </Callout>

      <div
        v-else-if="manifest"
        class="grid min-w-0 grid-cols-1 items-start gap-8 lg:grid-cols-[480px_minmax(0,1fr)] lg:gap-14"
      >
        <BuildForm
          :manifest="manifest"
          :state="state"
          :preset="preset"
          :axes="axes"
          :locked-by="lockedBy"
          :recommended="recommended"
          :name-error="nameError"
          @update:preset="selectPreset"
          @update:project-name="setProjectName"
          @answer="setAnswer"
          @toggle="toggleBundle"
        />

        <!-- The pane fills the viewport rather than the page: it scrolls inside itself while
             the seven questions beside it scroll the document. -->
        <div
          v-if="isDesktop"
          class="hidden min-w-0 lg:sticky lg:top-20 lg:flex lg:h-[calc(100dvh-6rem)] lg:max-h-[calc(100dvh-6rem)] lg:flex-col"
        >
          <BuildSetupPreview
            v-model:view="view"
            v-model:rendered="rendered"
            v-model:file-count="fileCount"
            :plan="plan"
            :warnings="warnings"
            :loading="snippetsLoading"
            :bundles="resolvedBundles"
            :project-name="state.projectName"
            :valid="valid"
            :downloading="downloading"
            @download="download"
            @copy-cli="copyCli"
            @copy-share="copyShareLink"
            @copy-markdown="copyMarkdown"
          />
        </div>
      </div>
    </div>

    <BuildPreviewSheet
      v-if="manifest && !schemaErrors.length && !isDesktop"
      v-model:open="sheetOpen"
      v-model:view="view"
      :summary="sheetSummary"
      :warnings="warnings.length"
      :valid="valid"
      :downloading="downloading"
      @download="download"
    >
      <BuildSetupPreview
        v-if="sheetOpen"
        v-model:view="view"
        v-model:rendered="rendered"
        v-model:file-count="fileCount"
        variant="sheet"
        :plan="plan"
        :warnings="warnings"
        :loading="snippetsLoading"
        :bundles="resolvedBundles"
        :project-name="state.projectName"
        :valid="valid"
        :downloading="downloading"
        @download="download"
        @copy-cli="copyCli"
        @copy-share="copyShareLink"
        @copy-markdown="copyMarkdown"
      />
    </BuildPreviewSheet>
  </div>
</template>
