import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Wiki ↔ code parity.
 *
 * `docs/wiki/_systems.json` is the registry: every system, the page that documents it, and
 * where it sits on the status ladder. This test is the only thing that makes the registry
 * true — prose reminders did not hold. It fails when a registered page is missing and when a
 * page exists that nobody registered, so neither half can drift on its own.
 *
 * Copy this file into the project's test directory (e.g. `test/docs/wiki-parity.test.ts`) so
 * it runs with the rest of the suite. `_index.md` is the hand-written landing page and is the
 * one file exempt from registration.
 */

const WIKI_DIR = join(process.cwd(), 'docs', 'wiki')
const REGISTRY_PATH = join(WIKI_DIR, '_systems.json')
const STATUSES = ['planned', 'building', 'shipped'] as const

interface System {
  id: string
  page: string
  status: (typeof STATUSES)[number]
}

function readRegistry(): System[] {
  if (!existsSync(REGISTRY_PATH)) {
    throw new Error(`${relative(process.cwd(), REGISTRY_PATH)} is missing — every wiki needs a registry`)
  }
  const parsed = JSON.parse(readFileSync(REGISTRY_PATH, 'utf8')) as { systems?: System[] }
  if (!Array.isArray(parsed.systems)) {
    throw new Error(`${relative(process.cwd(), REGISTRY_PATH)} must be { "systems": [{ "id", "page", "status" }] }`)
  }
  return parsed.systems
}

/** Every `.md` under docs/wiki/, as a path relative to docs/wiki/ with forward slashes. */
function wikiPages(dir = WIKI_DIR): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      out.push(...wikiPages(full))
    } else if (entry.endsWith('.md')) {
      out.push(relative(WIKI_DIR, full).split(sep).join('/'))
    }
  }
  return out
}

describe('docs/wiki parity', () => {
  const systems = readRegistry()
  const pages = wikiPages()

  it('registers at least one system', () => {
    expect(systems.length).toBeGreaterThan(0)
  })

  it('gives every system a unique id', () => {
    const ids = systems.map(s => s.id)
    expect(ids).toEqual([...new Set(ids)])
  })

  it('puts every system on the status ladder', () => {
    for (const system of systems) {
      expect(STATUSES, `system "${system.id}" has status "${system.status}"`).toContain(system.status)
    }
  })

  it('has a page on disk for every registered system', () => {
    const missing = systems.filter(s => !pages.includes(s.page)).map(s => `${s.id} → docs/wiki/${s.page}`)
    expect(missing, 'registered pages that do not exist').toEqual([])
  })

  it('has a registry entry for every page on disk', () => {
    const registered = new Set(systems.map(s => s.page))
    const orphans = pages.filter(p => p !== '_index.md' && !registered.has(p)).map(p => `docs/wiki/${p}`)
    expect(orphans, 'pages missing from docs/wiki/_systems.json').toEqual([])
  })
})
