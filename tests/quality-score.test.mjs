import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  REQUIRED_MODULES,
  THRESHOLD,
  renderHumanReport,
  scoreProject,
} from '../scripts/score-phase1-modules.mjs'
import {
  DIMENSIONS,
  MULTIDIM_THRESHOLD,
  renderMultiDimReport,
  scoreMultiDimProject,
} from '../scripts/score-multidim.mjs'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

test('quality rubric lists every Phase 1 required module with 10 total points', () => {
  const expectedIds = Array.from({ length: 13 }, (_, index) => `F${String(index + 1).padStart(2, '0')}`)
  assert.deepEqual(REQUIRED_MODULES.map((module) => module.id), expectedIds)
  assert.equal(THRESHOLD, 8.5)

  for (const module of REQUIRED_MODULES) {
    assert.ok(module.name)
    assert.ok(module.required)
    assert.ok(module.items.length >= 5, `${module.id} should have concrete scoring items`)
    const total = module.items.reduce((sum, item) => sum + item.weight, 0)
    assert.equal(total, 10, `${module.id} weights must total 10`)
    assert.equal(new Set(module.items.map((item) => item.id)).size, module.items.length)
  }
})

test('current project passes the Phase 1 module quality gate', async () => {
  const summary = await scoreProject(rootDir)
  assert.equal(summary.schema, 'hojokin-pocket.phase1.quality-score.v1')
  assert.equal(summary.requiredModuleCount, 13)
  assert.equal(summary.threshold, 8.5)
  assert.equal(summary.failedModules.length, 0)
  assert.equal(summary.passed, true)

  for (const module of summary.modules) {
    assert.ok(module.score >= summary.threshold, `${module.id} scored ${module.score}`)
    assert.equal(module.passed, true)
    assert.equal(module.items.some((item) => !item.passed), false)
  }

  const report = renderHumanReport(summary)
  assert.match(report, /Phase 1 required module quality score/)
  assert.match(report, /PASS F01 Login/)
  assert.match(report, /PASS F13 Audit logs/)
})

test('quality score CLI prints human report and JSON result', () => {
  const result = spawnSync(process.execPath, ['scripts/score-phase1-modules.mjs'], {
    cwd: rootDir,
    encoding: 'utf8',
  })

  assert.equal(result.status, 0, result.stderr || result.stdout)
  assert.match(result.stdout, /Phase 1 required module quality score/)
  assert.match(result.stdout, /JSON_RESULT_START/)

  const jsonText = result.stdout.split('JSON_RESULT_START\n')[1]
  assert.ok(jsonText, 'CLI should include JSON after marker')
  const parsed = JSON.parse(jsonText)
  assert.equal(parsed.passed, true)
  assert.equal(parsed.modules.length, 13)
  assert.deepEqual(parsed.failedModules, [])
})

test('multidimensional quality rubric requires every dimension to reach 95+', () => {
  const expectedIds = Array.from({ length: 10 }, (_, index) => `D${String(index + 1).padStart(2, '0')}`)
  assert.deepEqual(DIMENSIONS.map((dimension) => dimension.id), expectedIds)
  assert.equal(MULTIDIM_THRESHOLD, 95)

  for (const dimension of DIMENSIONS) {
    assert.ok(dimension.name)
    assert.ok(dimension.required)
    assert.ok(dimension.items.length >= 6, `${dimension.id} should have concrete scoring items`)
    const total = dimension.items.reduce((sum, item) => sum + item.weight, 0)
    assert.equal(total, 100, `${dimension.id} weights must total 100`)
    assert.equal(new Set(dimension.items.map((item) => item.id)).size, dimension.items.length)
  }
})

test('current project passes the multidimensional 95+ quality gate', async () => {
  const summary = await scoreMultiDimProject(rootDir)
  assert.equal(summary.schema, 'hojokin-pocket.multidim-score.v1')
  assert.equal(summary.dimensionCount, 10)
  assert.equal(summary.threshold, 95)
  assert.equal(summary.failedDimensions.length, 0)
  assert.equal(summary.passed, true)

  for (const dimension of summary.dimensions) {
    assert.ok(dimension.score >= summary.threshold, `${dimension.id} scored ${dimension.score}`)
    assert.equal(dimension.passed, true)
    assert.equal(dimension.items.some((item) => !item.passed), false)
  }

  const report = renderMultiDimReport(summary)
  assert.match(report, /multidimensional quality score/)
  assert.match(report, /PASS D01 Core MVP flow/)
  assert.match(report, /PASS D10 GitHub and CI readiness/)
})

test('multidimensional score CLI prints human report and JSON result', () => {
  const result = spawnSync(process.execPath, ['scripts/score-multidim.mjs'], {
    cwd: rootDir,
    encoding: 'utf8',
  })

  assert.equal(result.status, 0, result.stderr || result.stdout)
  assert.match(result.stdout, /Hojokin Pocket multidimensional quality score/)
  assert.match(result.stdout, /JSON_RESULT_START/)

  const jsonText = result.stdout.split('JSON_RESULT_START\n')[1]
  assert.ok(jsonText, 'CLI should include JSON after marker')
  const parsed = JSON.parse(jsonText)
  assert.equal(parsed.passed, true)
  assert.equal(parsed.dimensions.length, 10)
  assert.deepEqual(parsed.failedDimensions, [])
})
