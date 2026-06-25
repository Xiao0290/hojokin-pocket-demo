#!/usr/bin/env node
import assert from 'node:assert/strict'
import { spawnSync, spawn } from 'node:child_process'
import { promises as fs } from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { syntheticCompanyScenarios } from '../data/fixtures/synthetic-companies.mjs'

const rootDir = projectRoot()
const scriptPath = fileURLToPath(import.meta.url)
const args = new Set(process.argv.slice(2))
const requestedGate = process.argv.find((arg) => arg.startsWith('--gate='))?.slice('--gate='.length)

const GATES = {
  ssrf: runSsrfGate,
  export: runExportGate,
  'dev-fixture': runDevFixtureGate,
}

const REGRESSIONS = [
  {
    name: 'ssrf-redirect-recheck-disabled',
    gate: 'ssrf',
    file: 'server/services.mjs',
    search: '  await assertPublicUrl(redirected)\n  return redirected',
    replace: '  return redirected',
  },
  {
    name: 'export-expiry-check-disabled',
    gate: 'export',
    file: 'server/services.mjs',
    search: '  if (!record || new Date(record.expiresAt).getTime() < Date.now()) {\n    throw accessDeniedAsNotFoundError(\'export\')\n  }',
    replace: '  if (!record) {\n    throw accessDeniedAsNotFoundError(\'export\')\n  }',
  },
  {
    name: 'self-site-attestation-disabled',
    gate: 'dev-fixture',
    file: 'server/services.mjs',
    search: '  if (options.attested !== true) {',
    replace: '  if (false && options.attested !== true) {',
  },
  {
    name: 'synthetic-fixtures-enabled-by-default',
    gate: 'dev-fixture',
    file: 'server/services.mjs',
    search: "  if (process.env.SYNTHETIC_FIXTURE_MODE !== '1') return null",
    replace: "  if (false && process.env.SYNTHETIC_FIXTURE_MODE !== '1') return null",
  },
]

if (process.argv[1] === scriptPath) {
  try {
    if (args.has('--probe-only')) {
      await runProbeOnly()
    } else if (args.has('--negative-only')) {
      await runNegativeRegressionFixtures()
    } else {
      runSpawnedProbeGate()
      await runNegativeRegressionFixtures()
    }
  } catch (error) {
    console.error(error.stack || error.message || String(error))
    process.exit(1)
  }
}

function runSpawnedProbeGate() {
  const result = spawnSync(process.execPath, [scriptPath, '--probe-only'], {
    cwd: rootDir,
    encoding: 'utf8',
    env: cleanProbeEnv(process.env),
  })
  process.stdout.write(result.stdout)
  process.stderr.write(result.stderr)
  assert.equal(result.status, 0, `behavior probe gate exited ${result.status}`)
  console.log('PASS spawned behavior gate exit code')
}

async function runProbeOnly() {
  if (!requestedGate) {
    for (const gate of Object.keys(GATES)) {
      const result = spawnSync(process.execPath, [scriptPath, '--probe-only', `--gate=${gate}`], {
        cwd: rootDir,
        encoding: 'utf8',
        env: cleanProbeEnv(process.env),
      })
      process.stdout.write(result.stdout)
      process.stderr.write(result.stderr)
      assert.equal(result.status, 0, `${gate} behavior probe exited ${result.status}`)
    }
    return
  }
  const run = GATES[requestedGate]
  assert.equal(typeof run, 'function', `unknown gate: ${requestedGate}`)
  await run()
  console.log(`PASS ${requestedGate}`)
}

async function runNegativeRegressionFixtures() {
  for (const regression of REGRESSIONS) {
    await withMutatedWorkspace(regression, async (mutantDir) => {
      const result = spawnSync(process.execPath, ['scripts/quality-behavior-gates.mjs', '--probe-only', `--gate=${regression.gate}`], {
        cwd: mutantDir,
        encoding: 'utf8',
        env: cleanProbeEnv(process.env),
      })
      assert.notEqual(result.status, 0, `${regression.name} unexpectedly passed:\n${result.stdout}\n${result.stderr}`)
      console.log(`PASS negative regression ${regression.name} fails ${regression.gate}`)
    })
  }
}

async function runSsrfGate() {
  const { assertPublicUrl } = await import('../server/utils.mjs')
  const { validateRedirectLocation } = await import('../server/services.mjs')

  await assert.rejects(
    () => assertPublicUrl(new URL('http://169.254.169.254/latest/meta-data')),
    /このURLは診断に利用できません/,
  )
  await assert.rejects(
    () => validateRedirectLocation(new URL('https://example.com/start'), 'http://127.0.0.1/private'),
    /このURLは診断に利用できません/,
  )
  await assert.rejects(
    () => validateRedirectLocation(new URL('https://example.com/start'), '//169.254.169.254/latest/meta-data'),
    /このURLは診断に利用できません/,
  )
}

async function runExportGate() {
  const testRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'hojokin-quality-export-'))
  process.env.RUNTIME_DIR = path.join(testRoot, 'runtime')
  process.env.EXPORT_DIR = path.join(testRoot, 'exports')

  const {
    confirmBusinessPlanDraft,
    createBusinessPlan,
    exportPlan,
    getPlan,
  } = await import('../server/services.mjs')
  const { loadStore, mutateStore, resetStore } = await import('../server/store.mjs')
  const server = await startApiServer({
    API_PORT: String(await findFreePort()),
    RUNTIME_DIR: process.env.RUNTIME_DIR,
    EXPORT_DIR: process.env.EXPORT_DIR,
  })

  try {
    await resetStore()
    await mutateStore((store) => {
      store.companies.push({
        id: 'company_quality_export',
        userId: 'usr_dev_owner',
        name: '品質ゲート株式会社',
        url: 'https://quality-export.example/',
        prefecture: '東京都',
        city: '千代田区',
        profile: {
          id: 'profile_quality_export',
          name: '品質ゲート株式会社',
          businessSummary: '東京都内で宿泊運営とAI業務自動化を行う小規模事業者です。',
          keywords: ['宿泊運営', 'AI業務自動化', '省力化'],
          citations: [{ url: 'https://quality-export.example/', label: '開発用公式サイト' }],
          unknowns: ['資本金'],
        },
        sourceCitations: [],
        analyzedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      })
    })

    const missing = await fetch(`${server.baseUrl}/exports/missing.docx`)
    assert.equal(missing.status, 404, 'download route must reject files without export records')

    const planStart = await createBusinessPlan({
      companyId: 'company_quality_export',
      roundId: 'shoryokuka-ippan-7',
      targetChars: 4200,
    })
    const plan = await waitFor(async () => getPlan(planStart.planId), (value) => value?.status === 'draft')
    await confirmBusinessPlanDraft(plan.id, {
      draftResponsibility: true,
      sourceReview: true,
      noDelegatedFiling: true,
    })
    const docx = await exportPlan(plan.id, 'docx')
    const pdf = await exportPlan(plan.id, 'pdf')

    assert.equal(docx.filePath, undefined, 'export response must not expose local filesystem path')
    assert.equal(pdf.filePath, undefined, 'export response must not expose local filesystem path')
    assert.match(docx.fileUrl, /token=/, 'docx export URL must be signed')
    assert.match(pdf.fileUrl, /token=/, 'pdf export URL must be signed')

    const docxAllowed = await fetch(`${server.baseUrl}${docx.fileUrl}`)
    assert.equal(docxAllowed.status, 200, 'download route must serve unexpired docx export records')
    const pdfAllowed = await fetch(`${server.baseUrl}${pdf.fileUrl}`)
    assert.equal(pdfAllowed.status, 200, 'download route must serve unexpired pdf export records')
    const docxBody = Buffer.from(await docxAllowed.arrayBuffer())
    const pdfBody = Buffer.from(await pdfAllowed.arrayBuffer())
    assert.equal(docxBody.slice(0, 2).toString('utf8'), 'PK')
    assert.equal(pdfBody.slice(0, 5).toString('utf8'), '%PDF-')
    assert.match(readDocxText(docxBody), /申請者ご本人による下書き作成を支援/)
    assert.match(extractPdfUtf16Text(pdfBody), /申請者ご本人による下書き作成を支援/)

    await mutateStore((store) => {
      for (const plan of store.plans) {
        for (const record of plan.exports || []) {
          record.expiresAt = new Date(Date.now() - 60_000).toISOString()
        }
      }
    })
    const expired = await fetch(`${server.baseUrl}${docx.fileUrl}`)
    assert.equal(expired.status, 404, 'download route must reject expired export records')

    const finalStore = await loadStore()
    assert.equal(finalStore.plans.some((item) => item.exports?.some((record) => record.disclaimerIncluded === true)), true)
  } finally {
    await server.stop()
    await fs.rm(testRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 })
  }
}

async function runDevFixtureGate() {
  const testRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'hojokin-quality-dev-fixture-'))
  const previousSyntheticMode = process.env.SYNTHETIC_FIXTURE_MODE
  process.env.RUNTIME_DIR = path.join(testRoot, 'runtime')
  process.env.EXPORT_DIR = path.join(testRoot, 'exports')
  delete process.env.SYNTHETIC_FIXTURE_MODE

  const { createDiagnosis, devLogin, getDiagnosis } = await import('../server/services.mjs')
  const { loadStore, resetStore } = await import('../server/store.mjs')

  try {
    await resetStore()
    const login = await devLogin()
    assert.equal(login.token, 'dev-token')
    assert.equal(login.user.id, 'usr_dev_owner')
    const loginStore = await loadStore()
    assert.equal(loginStore.auditLogs.some((event) =>
      event.event === 'auth.login' && ['mock', 'local_mock'].includes(event.payload?.mode)), true)

    await assert.rejects(
      () => createDiagnosis('https://www.sample-corp.example'),
      /自社サイト/,
    )

    const synthetic = syntheticCompanyScenarios[0]
    const blocked = await createDiagnosis(synthetic.url, { attested: true })
    const failed = await waitFor(async () => getDiagnosis(blocked.diagnosisId), (value) => value?.status === 'failed')
    assert.match(failed.error.message, /会社サイトを確認できませんでした/)

    await resetStore()
    process.env.SYNTHETIC_FIXTURE_MODE = '1'
    const allowed = await createDiagnosis(synthetic.url, { attested: true })
    const diagnosis = await waitFor(async () => getDiagnosis(allowed.diagnosisId), (value) => value?.status === 'done')
    const store = await loadStore()
    const storedDiagnosis = store.diagnoses.find((item) => item.id === diagnosis.id)
    assert.equal(storedDiagnosis.scrape.warnings.some((warning) => warning.includes('開発用合成会社fixture')), true)
    const company = store.companies.find((item) => item.id === storedDiagnosis.companyId)
    assert.equal(company.profile.sourceType, 'synthetic_fixture')
  } finally {
    if (previousSyntheticMode === undefined) {
      delete process.env.SYNTHETIC_FIXTURE_MODE
    } else {
      process.env.SYNTHETIC_FIXTURE_MODE = previousSyntheticMode
    }
    await fs.rm(testRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 })
  }
}

async function withMutatedWorkspace(regression, callback) {
  const parent = await fs.mkdtemp(path.join(os.tmpdir(), 'hojokin-quality-mutant-'))
  const mutantDir = path.join(parent, 'repo')
  try {
    await fs.cp(rootDir, mutantDir, {
      recursive: true,
      filter: (source) => {
        const relative = path.relative(rootDir, source)
        if (!relative) return true
        return ![
          '.git',
          'node_modules',
          'data/runtime',
          'data/exports',
          'output',
        ].some((excluded) => relative === excluded || relative.startsWith(`${excluded}${path.sep}`))
      },
    })
    const target = path.join(mutantDir, regression.file)
    const source = await fs.readFile(target, 'utf8')
    assert.ok(source.includes(regression.search), `${regression.name} mutation target not found`)
    await fs.writeFile(target, source.replace(regression.search, regression.replace))
    await callback(mutantDir)
  } finally {
    await fs.rm(parent, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 })
  }
}

async function startApiServer(env) {
  const child = spawn(process.execPath, ['server/index.mjs'], {
    cwd: rootDir,
    env: { ...process.env, ...env, RESET_STORE: '0' },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let stdout = ''
  let stderr = ''
  child.stdout.on('data', (chunk) => {
    stdout += chunk.toString()
  })
  child.stderr.on('data', (chunk) => {
    stderr += chunk.toString()
  })
  const baseUrl = `http://127.0.0.1:${env.API_PORT}`
  try {
    await waitFor(async () => {
      try {
        const response = await fetch(`${baseUrl}/health`)
        return response.ok
      } catch {
        return false
      }
    }, Boolean, 5000)
  } catch (error) {
    child.kill('SIGTERM')
    throw new Error(`API server did not become ready: ${error.message}\nstdout:\n${stdout}\nstderr:\n${stderr}`)
  }
  return {
    baseUrl,
    async stop() {
      if (child.exitCode !== null) return
      child.kill('SIGTERM')
      await new Promise((resolve) => {
        child.once('exit', resolve)
        setTimeout(resolve, 1000)
      })
    },
  }
}

async function findFreePort() {
  return new Promise((resolve, reject) => {
    const server = http.createServer()
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      server.close(() => resolve(address.port))
    })
    server.on('error', reject)
  })
}

async function waitFor(load, predicate, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs
  let value
  while (Date.now() < deadline) {
    value = await load()
    if (predicate(value)) return value
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error(`Timed out waiting for condition. Last value: ${JSON.stringify(value)}`)
}

function readDocxText(buffer) {
  const raw = buffer.toString('utf8')
  const documentXml = raw.match(/<w:document[\s\S]*<\/w:document>/)?.[0] || raw
  return decodeXml(documentXml
    .replace(/<\/w:p>/g, '\n')
    .replace(/<[^>]+>/g, ' '))
}

function extractPdfUtf16Text(buffer) {
  const raw = buffer.toString('latin1')
  const textRuns = [...raw.matchAll(/<([0-9A-F]+)> Tj/g)]
  return textRuns.map((match) => {
    const be = Buffer.from(match[1], 'hex')
    const le = Buffer.alloc(be.length)
    for (let index = 0; index < be.length; index += 2) {
      le[index] = be[index + 1]
      le[index + 1] = be[index]
    }
    return le.toString('utf16le')
  }).join('\n')
}

function decodeXml(value) {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

function cleanProbeEnv(env) {
  const next = { ...env }
  delete next.RUNTIME_DIR
  delete next.EXPORT_DIR
  delete next.API_PORT
  delete next.RESET_STORE
  delete next.SYNTHETIC_FIXTURE_MODE
  return next
}

function projectRoot() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
}
