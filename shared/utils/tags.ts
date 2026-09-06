export interface TagCount {
  tag: string
  count: number
}

/**
 * Every tag across the bundles with how many carry it, most used first and ties broken
 * alphabetically — the order the chip row on `/skills` renders in.
 */
export function tagCounts(bundles: readonly { tags: readonly string[] }[]): TagCount[] {
  const counts = new Map<string, number>()
  for (const bundle of bundles) {
    for (const tag of bundle.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1)
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'en'))
    .map(([tag, count]) => ({ tag, count }))
}
