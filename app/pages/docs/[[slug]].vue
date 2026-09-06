<script setup lang="ts">
import type { DocResponse } from '~~/shared/types/docs'
import { docsNav } from '~~/content/docs/nav'

const route = useRoute()
const slug = computed(() => (typeof route.params.slug === 'string' && route.params.slug) || docsNav[0]!.slug)

// Server-rendered: /api/docs/<slug> ships the parsed MDC AST, so the browser never runs the
// markdown parser or the per-code-block highlight round trips.
const { data: doc, error } = await useFetch<DocResponse>(() => `/api/docs/${encodeURIComponent(slug.value)}`)

// /docs/** is ISR: a transient 5xx must stay a 5xx (Vercel keeps serving the stale page),
// because a 404 would be cached and pin the doc as permanently missing.
function docError(err: { statusCode?: number } | null | undefined) {
  const statusCode = err?.statusCode ?? 500
  return createError({
    statusCode,
    statusMessage: statusCode === 404 ? 'Doc not found' : 'Docs are temporarily unavailable',
    fatal: true
  })
}
if (error.value) throw docError(error.value)
// One route record covers every slug, so setup does not re-run when the slug changes.
watch(error, (err) => {
  if (err) showError(docError(err))
})

const navOpen = ref(false)
const position = computed(() => docsNav.findIndex(d => d.slug === slug.value) + 1)

// The `open` attribute is one-way, so mirror the user's own toggles back into the ref.
function onDisclosureToggle(event: Event) {
  navOpen.value = (event.target as HTMLDetailsElement).open
}

const { public: { siteUrl } } = useRuntimeConfig()

useSeoMeta({
  title: () => doc.value?.entry.title ?? 'Docs',
  description: () => doc.value?.entry.description ?? '',
  ogTitle: () => doc.value?.entry.title ?? 'Docs',
  ogDescription: () => doc.value?.entry.description ?? '',
  ogUrl: () => `${siteUrl.replace(/\/+$/, '')}/docs/${slug.value}`
})
</script>

<template>
  <div class="mx-auto max-w-[1080px] px-4 sm:px-6 py-6 lg:py-10">
    <div class="grid items-start gap-5 lg:grid-cols-[232px_minmax(0,1fr)] lg:gap-12">
      <!-- Below lg the grouped nav is a closed disclosure above the reading column. -->
      <details
        :open="navOpen"
        class="overflow-hidden rounded-xl border border-default bg-elevated lg:hidden"
        @toggle="onDisclosureToggle"
      >
        <summary class="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 font-mono text-[0.8125rem] text-default">
          <UIcon
            name="i-lucide-chevron-right"
            class="size-3.5 text-primary transition-transform"
            :class="{ 'rotate-90': navOpen }"
          />
          <UIcon
            name="i-lucide-book-open"
            class="size-[15px] text-dimmed"
          />
          Docs · {{ doc?.entry.title }}
          <span class="ms-auto text-[0.6875rem] text-dimmed">{{ position }} of {{ docsNav.length }}</span>
        </summary>
        <div class="border-t border-default px-3 py-3">
          <DocsNav
            :slug="slug"
            @select="navOpen = false"
          />
        </div>
      </details>

      <aside class="sticky top-20 hidden max-h-[calc(100dvh-6rem)] min-w-0 overflow-y-auto lg:block">
        <DocsNav :slug="slug" />
      </aside>

      <article class="min-w-0 max-w-3xl">
        <!-- The nav entry owns the page's single h1; the markdown's own `# Title` is dropped
             server-side (renderMarkdown's dropLeadingH1). -->
        <h1 class="m-0 mb-4 font-teko text-[44px] font-semibold leading-[.9] tracking-[-0.015em] text-default lg:text-[64px]">
          {{ doc?.entry.title }}
        </h1>

        <div class="docs-prose">
          <MarkdownView
            v-if="doc"
            :body="doc.body"
            :data="doc.data"
          />
        </div>

        <DocsFooter
          v-if="doc"
          :entry="doc.entry"
        />
      </article>
    </div>
  </div>
</template>

<style scoped>
/*
  The reading column from the approved design (docs/design/previews/_shared/page.css, `.prose`).
  Nuxt UI's Prose components carry their own utility classes; these element selectors are one
  step more specific, so they win without !important. Scoped to this page: the skill page's
  README keeps the shape Task 8 signed off on.
*/
.docs-prose :deep(h2) {
  margin: 2.25rem 0 0.75rem;
  font-family: var(--font-teko);
  font-size: 40px;
  font-weight: 600;
  line-height: 0.9;
  letter-spacing: -0.01em;
  color: var(--ui-text);
}

.docs-prose :deep(h3) {
  margin: 1.75rem 0 0.5rem;
  font-family: var(--font-teko);
  font-size: 26px;
  font-weight: 600;
  line-height: 1;
  letter-spacing: -0.01em;
  color: var(--ui-text);
}

.docs-prose :deep(h4) {
  margin: 1.5rem 0 0.5rem;
  font-size: 1rem;
  font-weight: 600;
  color: var(--ui-text);
}

.docs-prose :deep(p),
.docs-prose :deep(ul),
.docs-prose :deep(ol) {
  margin: 0 0 1rem;
  line-height: 1.75;
  color: var(--ui-text-muted);
}

.docs-prose :deep(li) {
  margin: 0 0 0.375rem;
}

.docs-prose :deep(a) {
  color: var(--color-green-500);
  text-decoration: none;
  border-bottom: 1px solid color-mix(in srgb, var(--color-green-500) 35%, transparent);
}

.dark .docs-prose :deep(a) {
  color: var(--color-green-400);
}

/* Mono paths, not chips: the design reads inline code as text, not as a badge. */
.docs-prose :deep(:not(pre) > code) {
  padding: 0;
  border: 0;
  background: none;
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  color: var(--ui-text);
}

.docs-prose :deep(table) {
  width: 100%;
  margin: 0 0 1.25rem;
  border-collapse: collapse;
  font-size: 0.875rem;
}

.docs-prose :deep(th) {
  padding: 0.5rem 0.75rem 0.5rem 0;
  border-bottom: 1px solid var(--ui-border);
  font-size: 0.75rem;
  font-weight: 400;
  text-align: left;
  text-transform: uppercase;
  letter-spacing: 0.2em;
  color: var(--ui-text-dimmed);
}

.docs-prose :deep(td) {
  padding: 0.625rem 0.75rem 0.625rem 0;
  border-bottom: 1px solid var(--ui-border);
  vertical-align: top;
  line-height: 1.6;
  color: var(--ui-text-muted);
}

/* A blockquote is the markdown pipeline's only way to ask for a callout, so it renders as
   the design's glass plate with the green rule rather than as an indented italic. */
.docs-prose :deep(blockquote) {
  margin: 0 0 1.25rem;
  padding: 20px;
  border: 1px solid var(--ui-border);
  border-left: 2px solid var(--color-green-500);
  border-radius: 0.75rem;
  background: rgba(0, 0, 0, 0.02);
  backdrop-filter: blur(12px);
  font-style: normal;
  color: var(--ui-text-muted);
}

.dark .docs-prose :deep(blockquote) {
  background: rgba(255, 255, 255, 0.03);
}

.docs-prose :deep(blockquote > :last-child) {
  margin-bottom: 0;
}
</style>
