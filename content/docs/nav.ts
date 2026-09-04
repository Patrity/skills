export interface DocEntry {
  slug: string
  title: string
  file: string
  description: string
}

export const docsNav: DocEntry[] = [
  { slug: 'start-here', title: 'Start here', file: 'start-here.md', description: 'Get the whole setup into a project, from the web or from a terminal.' },
  { slug: 'philosophy', title: 'Philosophy', file: 'philosophy.md', description: 'The five opinions the setup encodes, and what enforces each one.' },
  { slug: 'cli', title: 'CLI', file: 'cli.md', description: 'Every command and flag in @patrity/skills, and what each run writes.' },
  { slug: 'base-and-profiles', title: 'Base and profiles', file: 'base-and-profiles.md', description: 'How the questions become a CLAUDE.md, and how to add an axis or a profile.' },
  { slug: 'single-bundle', title: 'Single bundle', file: 'single-bundle.md', description: 'Take one bundle by hand and leave the rest of the setup alone.' },
  { slug: 'bundle-structure', title: 'Bundle structure', file: 'bundle-structure.md', description: 'What goes where inside skills/<slug>/.' },
  { slug: 'frontmatter', title: 'Frontmatter reference', file: 'frontmatter.md', description: 'Every README key, required or optional.' },
  { slug: 'hooks-and-settings', title: 'Hooks and settings', file: 'hooks-and-settings.md', description: 'The two settings files, hook scripts, and the files the tool manages for you.' },
  { slug: 'contributing', title: 'Contributing', file: 'contributing.md', description: 'How a pull request becomes a live bundle.' }
]
