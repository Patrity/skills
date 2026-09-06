<script setup lang="ts">
import type { LabFeedResponse } from '~~/shared/types/site'
import { LINKS } from '~~/shared/utils/links'

/**
 * The two newest posts from techhivelabs.net.
 *
 * The RSS fetch happens in /api/lab-feed, never here: the browser only ever talks to this
 * origin, and the route is ISR-cached for an hour. A failure there answers with the frozen
 * snapshot, so an empty list means our own route is down, in which case the section hides
 * rather than rendering a heading over nothing.
 */
const { data } = await useFetch<LabFeedResponse>('/api/lab-feed', {
  key: 'home:lab-feed',
  // A dead feed must not take the home page down with it.
  default: () => ({ posts: [], source: 'fallback' as const })
})

const posts = computed(() => data.value?.posts ?? [])

const dateFormat = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })

/** "August 19, 2026 · 10 min read". The read time only when the feed carried a body to measure. */
function when(post: LabFeedResponse['posts'][number]): string {
  const date = dateFormat.format(new Date(post.date))
  return post.readMinutes ? `${date} · ${post.readMinutes} min read` : date
}
</script>

<template>
  <section
    v-if="posts.length"
    class="py-12 lg:py-20 border-t border-default"
  >
    <div class="max-w-7xl mx-auto px-4 sm:px-6">
      <div class="max-w-3xl mb-7 lg:mb-10">
        <MicroLabel class="block mb-2.5">
          From the lab
        </MicroLabel>
        <h2 class="font-teko font-semibold text-4xl lg:text-[46px] leading-[.9] tracking-[-0.01em] m-0">
          What broke recently.
        </h2>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <a
          v-for="post in posts"
          :key="post.url"
          :href="post.url"
          target="_blank"
          rel="noopener"
          class="group glass-card glow block p-6 no-underline transition-shadow"
        >
          <span class="font-mono text-xs text-dimmed">{{ when(post) }}</span>
          <h3 class="font-teko font-semibold text-[30px] leading-[.95] tracking-[-0.01em] my-2.5 text-default group-hover:text-primary transition-colors">
            {{ post.title }}
          </h3>
          <p
            v-if="post.summary"
            class="m-0 text-sm/[1.55] text-muted"
          >
            {{ post.summary }}
          </p>
        </a>
      </div>

      <div class="mt-8">
        <a
          :href="LINKS.lab"
          target="_blank"
          rel="noopener"
          class="glow inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-(--color-green-500) font-semibold text-[0.9375rem] text-primary hover:bg-primary/10 transition-colors"
        >
          Read the lab notes
          <UIcon
            name="i-lucide-external-link"
            class="size-4"
          />
        </a>
      </div>
    </div>
  </section>
</template>
