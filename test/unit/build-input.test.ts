import { describe, expect, it } from 'vitest'
import { validateBuildInput } from '../../server/lib/setup/build-input'
import { fixtureManifest } from '../../cli/test/helpers/fixtures'

const manifest = fixtureManifest()
describe('validateBuildInput', () => {
  it('accepts a valid body', () => {
    expect(validateBuildInput({ projectName: 'my-app', answers: { pm: 'pnpm' }, bundles: ['demo'] }, manifest)).toMatchObject({ ok: true })
  })
  it('rejects with the CLI wording', () => {
    expect(validateBuildInput({ projectName: 'my-app', answers: { pm: 'bun2' }, bundles: [] }, manifest)).toEqual({ ok: false, status: 400, message: 'pm: "bun2" is not an option' })
    expect(validateBuildInput({ projectName: 'my-app', answers: {}, bundles: ['ghost'] }, manifest)).toEqual({ ok: false, status: 400, message: 'unknown bundle: ghost' })
    expect(validateBuildInput({ projectName: '../x', answers: {}, bundles: [] }, manifest)).toEqual({ ok: false, status: 400, message: 'projectName: must match ^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$' })
    expect(validateBuildInput({ projectName: 'a', answers: {}, bundles: ['demo', 'demo'] }, manifest)).toEqual({ ok: false, status: 400, message: 'bundles: duplicate demo' })
  })
})
