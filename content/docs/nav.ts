/** The nav heading an entry sits under. Groups render in the order the entries appear. */
export type DocGroup = 'Start' | 'Reference' | 'Contribute'

export interface DocEntry {
  slug: string
  title: string
  file: string
  description: string
  group: DocGroup
}

export const docsNav: DocEntry[] = [
  { slug: 'start-here', title: 'Start here', file: 'start-here.md', group: 'Start', description: 'The whole setup into a project, from a browser or a terminal, in five steps.' },
  { slug: 'philosophy', title: 'Philosophy', file: 'philosophy.md', group: 'Start', description: 'The five opinions the setup encodes, and what enforces each one.' },
  { slug: 'cli', title: 'CLI', file: 'cli.md', group: 'Reference', description: 'Every command and flag in @patrity/skills, and what each run writes.' },
  { slug: 'base-and-profiles', title: 'Base and profiles', file: 'base-and-profiles.md', group: 'Reference', description: 'How the questions become a CLAUDE.md, and how to add an axis or a profile.' },
  { slug: 'single-bundle', title: 'Single bundle', file: 'single-bundle.md', group: 'Reference', description: 'Take one bundle by hand and leave the rest of the setup alone.' },
  { slug: 'bundle-structure', title: 'Bundle structure', file: 'bundle-structure.md', group: 'Reference', description: 'What goes where inside skills/<slug>/, and what the site throws away.' },
  { slug: 'frontmatter', title: 'Frontmatter reference', file: 'frontmatter.md', group: 'Reference', description: 'Every README key, which ones are required, and what the site derives on its own.' },
  { slug: 'hooks-and-settings', title: 'Hooks and settings', file: 'hooks-and-settings.md', group: 'Reference', description: 'The two settings files, hook scripts, and the files the tool manages for you.' },
  { slug: 'contributing', title: 'Contributing', file: 'contributing.md', group: 'Contribute', description: 'How a pull request becomes a live bundle.' }
]
