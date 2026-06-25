import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test, { after } from 'node:test'
import { writeClosedBetaPublishedSeedStore } from '../scripts/publish-seed-drafts.mjs'

const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'hojokin-pocket-expert-fallback-'))

after(async () => {
  await fs.rm(tempRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 })
})

test('published seed matches keep at least three sourced expert recommendation candidates', async () => {
  const runtimeDir = path.join(tempRoot, 'runtime')
  await fs.mkdir(runtimeDir, { recursive: true })
  await writeClosedBetaPublishedSeedStore({
    outputPath: path.join(runtimeDir, 'published-seed-rounds.json'),
    reviewer: 'codex-test',
    generatedAt: '2026-06-21T00:00:00.000Z',
  })

  const previousRuntimeDir = process.env.RUNTIME_DIR
  process.env.RUNTIME_DIR = runtimeDir
  const services = await import(`../server/services.mjs?expert-fallback=${Date.now()}`)
  if (previousRuntimeDir === undefined) {
    delete process.env.RUNTIME_DIR
  } else {
    process.env.RUNTIME_DIR = previousRuntimeDir
  }

  await services.devLogin()
  const created = await services.createDiagnosis('https://www.sample-corp.example', { attested: true })
  const diagnosis = await waitForDiagnosisDone(services, created.diagnosisId)
  assert.equal(diagnosis.status, 'done')

  const matches = await services.getMatches(created.diagnosisId)
  assert.equal(matches.summary.matchCount, 5)
  assert.equal(matches.matches[0].roundId, 'kobe_challenge_support_2026')

  const recommendations = await services.recommendExperts({
    diagnosisId: created.diagnosisId,
    roundId: matches.matches[0].roundId,
  })
  assert.ok(recommendations.recommendations.length >= 3)
  assert.ok(recommendations.recommendations.every((item) => item.sourceUrl))
  assert.ok(recommendations.recommendations.some((item) => item.fallbackCandidate === true))
  assert.ok(recommendations.recommendations.some((item) =>
    item.reasons.some((reason) => reason.includes('対応可否を確認')),
  ))
})

async function waitForDiagnosisDone(services, diagnosisId) {
  const started = Date.now()
  while (Date.now() - started < 8000) {
    const diagnosis = await services.getDiagnosis(diagnosisId)
    if (diagnosis.status === 'done' || diagnosis.status === 'error') return diagnosis
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error('diagnosis did not finish')
}
