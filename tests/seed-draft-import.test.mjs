import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test, { after } from 'node:test'
import {
  buildSeedDraftStore,
  CRITICAL_REVIEW_FIELDS,
  mergeSeedDraftStores,
  REVIEW_TASK_FIELD_ALIASES,
} from '../scripts/import-seed-draft-pack.mjs'

const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'hojokin-pocket-seed-draft-'))
const fixture = JSON.parse(readFileSync('data/fixtures/subsidy-programs.json', 'utf8'))

after(async () => {
  await fs.rm(tempRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 })
})

test('seed DB v0.1 imports into draft-only store with manifest counts and no canonical writes', async () => {
  const store = await buildSeedDraftStore({ generatedAt: '2026-06-20T00:00:00.000Z' })

  assert.equal(store.schema, 'hojokin-pocket.seed-draft-store.v1')
  assert.equal(store.mode, 'draft_only')
  assert.equal(store.pack.sha256Verified, true)
  assert.equal(store.summary.sourceCount, 22)
  assert.equal(store.summary.roundDraftCount, 33)
  assert.equal(store.summary.reviewTaskCount, 84)
  assert.equal(store.summary.licenseReviewCount, 22)
  assert.equal(store.summary.eligibilityDraftCount, 9)
  assert.equal(store.summary.publishableCount, 0)
  assert.equal(store.summary.canonicalRoundWriteCount, 0)
  assert.equal(store.userSideMatchingVisible, false)

  for (const round of store.subsidyRoundDrafts) {
    assert.equal(round.reviewRequired, true, round.roundKey)
    assert.equal(round.reviewStatus, 'needs_review', round.roundKey)
    assert.equal(round.publishable, false, round.roundKey)
    assert.equal(round.adoptionRate, null, round.roundKey)
    assert.equal(round.adoptionRateSourceUrl, null, round.roundKey)
  }
})

test('missing critical fields have source review tasks before publish', async () => {
  const store = await buildSeedDraftStore({ generatedAt: '2026-06-20T00:00:00.000Z' })
  const taskKeys = new Set(store.sourceReviewTasks.map((task) => [
    task.program_name,
    task.round_name,
    task.field_name,
  ].join('\u0000')))
  const missingRounds = store.subsidyRoundDrafts.filter((round) => round.criticalMissingFields.length > 0)

  assert.ok(missingRounds.length > 0)
  assert.ok(store.summary.missingCriticalFieldCount > 0)
  for (const round of missingRounds) {
    for (const field of round.criticalMissingFields) {
      assert.ok(CRITICAL_REVIEW_FIELDS.includes(field), `${round.roundKey}:${field}`)
      assert.ok((round.criticalReviewTaskIds[field] || []).length > 0, `${round.roundKey}:${field}`)
      assert.ok((REVIEW_TASK_FIELD_ALIASES[field] || [field]).some((taskField) => taskKeys.has([
        round.programName,
        round.roundName,
        taskField,
      ].join('\u0000'))), `${round.roundKey}:${field}`)
    }
  }
})

test('multi-cap programs remain split by round/category in draft import', async () => {
  const store = await buildSeedDraftStore({ generatedAt: '2026-06-20T00:00:00.000Z' })
  const kobeInvestmentRounds = store.subsidyRoundDrafts
    .filter((round) => round.roundKey.startsWith('kobe_invest_'))
    .map((round) => round.roundKey)
    .sort()

  assert.deepEqual(kobeInvestmentRounds, [
    'kobe_invest_general_2026',
    'kobe_invest_iot_ai_robot_2026',
    'kobe_invest_robot_si_2026',
    'kobe_invest_robot_sim_2026',
  ])
})

test('draft import is idempotent by round_key and task_id', async () => {
  const store = await buildSeedDraftStore({ generatedAt: '2026-06-20T00:00:00.000Z' })
  const merged = mergeSeedDraftStores(store, store)

  assert.equal(merged.summary.roundDraftCount, store.summary.roundDraftCount)
  assert.equal(merged.summary.reviewTaskCount, store.summary.reviewTaskCount)
  assert.equal(merged.summary.sourceCount, store.summary.sourceCount)
  assert.equal(new Set(merged.subsidyRoundDrafts.map((round) => round.roundKey)).size, store.summary.roundDraftCount)
})

test('CLI writes runtime draft store without mutating user-side matching fixtures', async () => {
  const outputPath = path.join(tempRoot, 'seed-draft-store.json')
  const run = spawnSync(process.execPath, [
    'scripts/import-seed-draft-pack.mjs',
    '--output',
    outputPath,
  ], { encoding: 'utf8' })

  assert.equal(run.status, 0, run.stderr || run.stdout)
  assert.match(run.stdout, /0 canonical writes/)
  const store = JSON.parse(await fs.readFile(outputPath, 'utf8'))
  assert.equal(store.summary.roundDraftCount, 33)
  assert.equal(store.summary.publishableCount, 0)

  const runtimeDir = path.join(tempRoot, 'draft-only-runtime')
  await fs.mkdir(runtimeDir, { recursive: true })
  const previous = process.env.RUNTIME_DIR
  process.env.RUNTIME_DIR = runtimeDir
  const { activeSubsidyRounds } = await import(`../server/fixtures.mjs?draft-only-runtime=${Date.now()}`)
  if (previous === undefined) {
    delete process.env.RUNTIME_DIR
  } else {
    process.env.RUNTIME_DIR = previous
  }

  assert.equal(activeSubsidyRounds.length, fixture.programs.length)
  const activeRoundIds = new Set(activeSubsidyRounds.map((round) => round.roundId))
  for (const round of store.subsidyRoundDrafts) {
    assert.equal(activeRoundIds.has(round.roundKey), false, round.roundKey)
  }
})
