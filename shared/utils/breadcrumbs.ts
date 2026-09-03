import type { BreadcrumbItem } from '@nuxt/ui'

/**
 * Collapse a deep breadcrumb trail for narrow viewports: keep the first two crumbs
 * and the last one, and stand an ellipsis in for everything between
 * (Skills › Bundle › … › file.py). Returns the input untouched when collapsing
 * would not actually shorten it.
 */
export function compactBreadcrumbs(items: BreadcrumbItem[], max = 3): BreadcrumbItem[] {
  if (items.length <= max + 1) return items
  return [items[0]!, items[1]!, { label: '…' }, items[items.length - 1]!]
}
