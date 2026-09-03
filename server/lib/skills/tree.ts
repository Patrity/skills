import type { ContentBadge, FileKind, TreeNode } from '../../../shared/types/skills'

export function buildTree(entries: Record<string, { size: number, kind: FileKind }>): TreeNode[] {
  const root: TreeNode[] = []
  for (const path of Object.keys(entries).sort()) {
    const parts = path.split('/')
    let level = root
    let acc = ''
    parts.forEach((part, i) => {
      acc = acc ? `${acc}/${part}` : part
      const isLeaf = i === parts.length - 1
      let node = level.find(n => n.name === part && n.type === (isLeaf ? 'file' : 'dir'))
      if (!node) {
        node = isLeaf
          ? { name: part, path: acc, type: 'file', size: entries[path]!.size, kind: entries[path]!.kind }
          : { name: part, path: acc, type: 'dir', children: [] }
        level.push(node)
      }
      if (!isLeaf) level = node.children!
    })
  }
  return sortTree(root)
}

function sortTree(nodes: TreeNode[]): TreeNode[] {
  nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'dir' ? -1 : 1
    return a.name.localeCompare(b.name, 'en', { sensitivity: 'base' })
  })
  for (const n of nodes) if (n.children) sortTree(n.children)
  return nodes
}

export function findFile(tree: TreeNode[], path: string): TreeNode | null {
  for (const node of tree) {
    if (node.type === 'file' && node.path === path) return node
    if (node.children && path.startsWith(`${node.path}/`)) {
      const found = findFile(node.children, path)
      if (found) return found
    }
  }
  return null
}

const BADGE_ORDER: ContentBadge[] = ['skills', 'rules', 'hooks', 'settings', 'claude-md']

export function deriveBadges(paths: string[]): ContentBadge[] {
  const found = new Set<ContentBadge>()
  for (const p of paths) {
    if (p.startsWith('skills/')) found.add('skills')
    else if (p.startsWith('rules/')) found.add('rules')
    else if (p.startsWith('hooks/')) found.add('hooks')
    else if (p === 'settings.local.json') found.add('settings')
    else if (p.toLowerCase() === 'claude.md') found.add('claude-md')
  }
  return BADGE_ORDER.filter(b => found.has(b))
}
