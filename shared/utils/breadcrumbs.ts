import type { BreadcrumbItem } from '@nuxt/ui'

/**
 * Collapse a deep breadcrumb trail for narrow viewports: keep the first two crumbs
 * and the last one, and stand an ellipsis in for everything between
 * (Skills › Bundle › … › file.py). Returns the input untouched when collapsing
 * would not actually shorten it.
 *
 * The ellipsis crumb is `shrink-0`: the breadcrumb's own `item` slot is `flex min-w-0`,
 * so without it the marker competes for width with the real crumbs and gets clipped
 * to nothing on a phone.
 */
export function compactBreadcrumbs(items: BreadcrumbItem[], max = 3): BreadcrumbItem[] {
  if (items.length <= max + 1) return items
  return [items[0]!, items[1]!, { label: '…', ui: { item: 'shrink-0' } }, items[items.length - 1]!]
}
