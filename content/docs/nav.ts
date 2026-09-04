export interface DocEntry {
  slug: string
  title: string
  file: string
  description: string
}

export const docsNav: DocEntry[] = [
  { slug: 'getting-started', title: 'Getting started', file: 'getting-started.md', description: 'Install a bundle into a project in under a minute.' },
  { slug: 'bundle-structure', title: 'Bundle structure', file: 'bundle-structure.md', description: 'What goes where inside skills/<slug>/.' },
  { slug: 'frontmatter', title: 'Frontmatter reference', file: 'frontmatter.md', description: 'Every README key, required or optional.' },
  { slug: 'hooks-and-settings', title: 'Hooks and settings', file: 'hooks-and-settings.md', description: 'Shipping settings.local.json and hook scripts.' },
  { slug: 'contributing', title: 'Contributing', file: 'contributing.md', description: 'How a pull request becomes a live bundle.' },
  { slug: 'cli', title: 'CLI', file: 'cli.md', description: 'Install and manage bundles from a project directory.' },
  { slug: 'base-and-profiles', title: 'Base and profiles', file: 'base-and-profiles.md', description: 'How the wizard assembles CLAUDE.md, and how to add an axis or a profile.' }
]
