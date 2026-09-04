/** Where the CLI writes the lockfile. Only the filesystem side of the setup knows about paths. */
export const LOCKFILE_PATH = '.claude/skills.lock.json'

export * from '../../shared/setup/lock'
