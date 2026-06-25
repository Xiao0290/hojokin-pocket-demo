import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test, { after } from 'node:test'
import { buildSeedDraftStore } from '../scripts/import-seed-draft-pack.mjs'
import {
  buildClosedBetaPublishedSeedStore,
  writeClosedBetaPublishedSeedStore,
} from '../scripts/publish-seed-drafts.mjs'

const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'hojokin-pocket-seed-publish-'))
const fixture = JSON.parse(readFileSync('data/fixtures/subsidy-programs.json', 'utf8'))

after(async () => {
  await fs.rm(tempRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 })
})

test('closed-beta seed publishing requires an explicit reviewer', async () => {
  const draftStore = await buildSeedDraftStore({ generatedAt: '2026-06-20T00:00:00.000Z' })
  assert.throws(
    () => buildClosedBetaPublishedSeedStore({ draftStore }),
    /--reviewer is required/,
  )

  const run = spawnSync(process.execPath, [
    'scripts/publish-seed-drafts.mjs',
    '--dry-run',
  ], { encoding: 'utf8' })
  assert.notEqual(run.status, 0)
  assert.match(run.stderr, /--reviewer is required/)
})

test('closed-beta seed publishing emits only machine-safe runtime rounds', async () => {
  const draftStore = await buildSeedDraftStore({ generatedAt: '2026-06-20T00:00:00.000Z' })
  const published = buildClosedBetaPublishedSeedStore({
    draftStore,
    reviewer: 'codex-test',
    generatedAt: '2026-06-21T00:00:00.000Z',
  })

  assert.equal(published.schema, 'hojokin-pocket.published-seed-rounds.v1')
  assert.equal(published.userSideMatchingVisible, true)
  assert.equal(published.summary.publishedRoundCount, 12)
  assert.equal(published.summary.adoptionRatePublishedCount, 0)
  assert.equal(published.summary.canonicalRoundWriteCount, 0)
  assert.equal(published.programs.some((program) => program.id === 'jizokuka_normal_20'), false)
  assert.equal(published.programs.some((program) => program.id === 'digital_ai_2026_normal_3'), false)

  for (const program of published.programs) {
    assert.ok(program.maxLimit.amountYen > 0, program.id)
    assert.ok(program.subsidyRate.display, program.id)
    assert.ok(program.acceptEnd.value, program.id)
    assert.equal(program.closedBetaReview.machineGate, 'pass', program.id)
    assert.equal(program.sourceRecord.automationMode, 'closed_beta_manual_review_snapshot', program.id)
    assert.equal('adoptionRate' in program, false, program.id)
    assert.ok(program.sourceNotes.some((note) => note.includes('採択率')), program.id)
  }
})

test('closed-beta publish command writes idempotent runtime store', async () => {
  const outputPath = path.join(tempRoot, 'published-seed-rounds.json')
  const first = await writeClosedBetaPublishedSeedStore({
    outputPath,
    reviewer: 'codex-test',
    generatedAt: '2026-06-21T00:00:00.000Z',
  })
  const second = await writeClosedBetaPublishedSeedStore({
    outputPath,
    reviewer: 'codex-test',
    generatedAt: '2026-06-21T00:00:00.000Z',
  })

  assert.equal(first.publishedStore.summary.publishedRoundCount, second.publishedStore.summary.publishedRoundCount)
  const written = JSON.parse(await fs.readFile(outputPath, 'utf8'))
  assert.equal(written.summary.publishedRoundCount, 12)
  assert.deepEqual(
    written.programs.map((program) => program.id),
    second.publishedStore.programs.map((program) => program.id),
  )
})

test('matching data source stays unchanged without a runtime published store', async () => {
  const runtimeDir = path.join(tempRoot, 'empty-runtime')
  await fs.mkdir(runtimeDir, { recursive: true })
  const previous = process.env.RUNTIME_DIR
  process.env.RUNTIME_DIR = runtimeDir
  const { activeSubsidyRounds } = await import(`../server/fixtures.mjs?empty-runtime=${Date.now()}`)
  if (previous === undefined) {
    delete process.env.RUNTIME_DIR
  } else {
    process.env.RUNTIME_DIR = previous
  }

  assert.equal(activeSubsidyRounds.length, fixture.programs.length)
})

test('matching data source merges closed-beta published seed rounds when runtime store exists', async () => {
  const runtimeDir = path.join(tempRoot, 'published-runtime')
  await fs.mkdir(runtimeDir, { recursive: true })
  await writeClosedBetaPublishedSeedStore({
    outputPath: path.join(runtimeDir, 'published-seed-rounds.json'),
    reviewer: 'codex-test',
    generatedAt: '2026-06-21T00:00:00.000Z',
  })

  const previous = process.env.RUNTIME_DIR
  process.env.RUNTIME_DIR = runtimeDir
  const { activeSubsidyRounds } = await import(`../server/fixtures.mjs?published-runtime=${Date.now()}`)
  if (previous === undefined) {
    delete process.env.RUNTIME_DIR
  } else {
    process.env.RUNTIME_DIR = previous
  }

  assert.equal(activeSubsidyRounds.length, fixture.programs.length + 12)
  assert.ok(activeSubsidyRounds.some((round) => round.roundId === 'kobe_dx_system_model_2026'))
  assert.ok(activeSubsidyRounds.some((round) => round.keywords.includes('AI業務自動化')))
  assert.ok(activeSubsidyRounds.every((round) => round.adoptionRate === null))
})
