import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test, { after } from 'node:test'
import {
  buildSourceRefreshSummary,
  contentHashForProgram,
  evaluateLicenseGate,
  normalizeRefreshStatus,
} from '../server/sourceRefresh.mjs'

const testRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'hojokin-pocket-source-refresh-'))
const fixture = JSON.parse(readFileSync('data/fixtures/subsidy-programs.json', 'utf8'))

after(async () => {
  await fs.rm(testRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 })
})

test('normalizes official source refresh states', () => {
  assert.equal(normalizeRefreshStatus('open'), 'open')
  assert.equal(normalizeRefreshStatus('closed_waiting_results'), 'closed')
  assert.equal(normalizeRefreshStatus('announced_not_open'), 'announced')
  assert.equal(normalizeRefreshStatus('announced_acceptance_pending'), 'announced')
})

test('reports unchanged content hash and evidence support from fixture metadata', () => {
  const program = fixture.programs.find((item) => item.id === 'it-digital-ai-2026-normal-3')
  const summary = buildSourceRefreshSummary(program, { today: '2026-06-20' })

  assert.equal(summary.contentHash, program.sourceRecord.contentHash)
  assert.equal(summary.contentHashChanged, false)
  assert.equal(summary.statusGroup, 'open')
  assert.equal(summary.stale, false)
  assert.ok(summary.evidenceSupportedFields.includes('sourceUrl'))
  assert.equal(summary.sourceRecord.automationMode, 'manual')
  assert.equal(summary.gate.productionEtlAllowed, false)
})

test('reports changed content hash before any fixture mutation', () => {
  const program = fixture.programs.find((item) => item.id === 'jizokuka-normal-20')
  const changed = {
    ...program,
    status: 'open',
  }
  const summary = buildSourceRefreshSummary(changed, { today: '2026-06-20' })

  assert.notEqual(summary.contentHash, program.sourceRecord.contentHash)
  assert.equal(summary.contentHashChanged, true)
  assert.equal(summary.statusGroup, 'open')
})

test('surfaces stale-source warnings from lastSeenAt', () => {
  const program = fixture.programs.find((item) => item.id === 'shoryokuka-ippan-7')
  const summary = buildSourceRefreshSummary(program, { today: '2026-07-20' })

  assert.equal(summary.stale, true)
  assert.match(summary.warning, /Source metadata is stale/)
})

test('normalized subsidy fixtures expose stale-source warnings for service pass-through', async () => {
  const previousToday = process.env.SOURCE_REFRESH_TODAY
  process.env.SOURCE_REFRESH_TODAY = '2026-07-20'
  const { activeSubsidyRounds } = await import(`../server/fixtures.mjs?stale-test=${Date.now()}`)
  if (previousToday === undefined) {
    delete process.env.SOURCE_REFRESH_TODAY
  } else {
    process.env.SOURCE_REFRESH_TODAY = previousToday
  }

  const round = activeSubsidyRounds.find((item) => item.roundId === 'shoryokuka-ippan-7')
  assert.equal(round.sourceRefresh.stale, true)
  assert.match(round.sourceRefresh.warning, /Source metadata is stale/)
  assert.ok(round.sourceRefresh.evidenceSupportedFields.includes('sourceUrl'))
})

test('license gate keeps restricted and unresolved sources out of production ETL', () => {
  const restricted = evaluateLicenseGate({ licenseStatus: 'restricted', automationMode: 'manual' })
  const unresolved = evaluateLicenseGate({ licenseStatus: 'unresolved', automationMode: 'manual' })
  const automatedRestricted = evaluateLicenseGate({ licenseStatus: 'restricted', automationMode: 'automated' })

  assert.equal(restricted.productionEtlAllowed, false)
  assert.equal(unresolved.productionEtlAllowed, false)
  assert.equal(automatedRestricted.productionEtlAllowed, false)
})

test('dry-run script writes an artifact without mutating fixtures', async () => {
  const outputPath = path.join(testRoot, 'source-refresh-dry-run.json')
  const before = contentHashForProgram(fixture.programs[0])
  const run = spawnSync(process.execPath, [
    'scripts/source-refresh-dry-run.mjs',
    '--today',
    '2026-06-20',
    '--output',
    outputPath,
  ], { encoding: 'utf8' })

  assert.equal(run.status, 0, run.stderr || run.stdout)
  assert.match(run.stdout, /source refresh dry-run/)
  const report = JSON.parse(await fs.readFile(outputPath, 'utf8'))
  assert.equal(report.mode, 'dry-run')
  assert.equal(report.mutation, 'none')
  assert.equal(report.summary.programCount, fixture.programs.length)
  assert.equal(report.summary.changedContentHashes, 0)
  assert.equal(contentHashForProgram(fixture.programs[0]), before)
})
