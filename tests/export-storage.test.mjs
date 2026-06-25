import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test, { after, afterEach, beforeEach } from 'node:test'

const testRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'hojokin-export-storage-'))
process.env.RUNTIME_DIR = path.join(testRoot, 'runtime')
process.env.EXPORT_DIR = path.join(testRoot, 'exports')
process.env.EXPORT_SIGNING_SECRET = 'export-storage-test-secret'

const services = await import('../server/services.mjs')
const store = await import('../server/store.mjs')

const {
  confirmBusinessPlanDraft,
  configureServicePorts,
  createBusinessPlan,
  exportPlan,
  getPlan,
  readExportDownload,
  resetServicePorts,
} = services
const { mutateStore, resetStore } = store

const owner = { id: 'usr_dev_owner', email: 'owner@example.test', role: 'owner' }
const otherUser = { id: 'other_user', email: 'other@example.test', role: 'owner' }

after(async () => {
  await fs.rm(testRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 })
})

beforeEach(async () => {
  resetServicePorts()
  await resetStore()
  await seedCompany()
})

afterEach(() => {
  resetServicePorts()
})

test('exportPlan returns signed storage metadata without exposing filesystem paths', async () => {
  configureUser(owner)
  const planStart = await createBusinessPlan({
    companyId: 'company_export_storage',
    roundId: 'shoryokuka-ippan-7',
    targetChars: 4200,
  })
  const plan = await waitFor(() => getPlan(planStart.planId), (value) => value?.status === 'draft')
  await confirmDraft(plan.id)
  const exported = await exportPlan(plan.id, 'docx')

  assert.equal(exported.filePath, undefined)
  assert.equal(exported.storageProvider, 'local')
  assert.equal(exported.storageKey, `${plan.id}.docx`)
  assert.equal(exported.filename, `${plan.id}.docx`)
  assert.equal(exported.mimeType, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
  assert.ok(exported.sizeBytes > 64)
  assert.match(exported.checksum, /^[a-f0-9]{64}$/)
  assert.match(exported.fileUrl, /^\/exports\/[^?]+\.docx\?token=/)

  const token = tokenFromUrl(exported.fileUrl)
  const download = await readExportDownload(exported.filename, token)
  assert.equal(download.body.slice(0, 2).toString('utf8'), 'PK')

  await assert.rejects(
    () => readExportDownload(exported.filename, null),
    (error) => error.code === 'NOT_FOUND' && error.status === 404,
  )
  await assert.rejects(
    () => readExportDownload(exported.filename, `${token}tampered`),
    (error) => error.code === 'NOT_FOUND' && error.status === 404,
  )

  configureUser(otherUser)
  await assert.rejects(
    () => readExportDownload(exported.filename, token),
    (error) => error.code === 'NOT_FOUND' && error.status === 404,
  )
})

test('signed export downloads fail after record expiry', async () => {
  configureUser(owner)
  const planStart = await createBusinessPlan({
    companyId: 'company_export_storage',
    roundId: 'shoryokuka-ippan-7',
    targetChars: 4200,
  })
  const plan = await waitFor(() => getPlan(planStart.planId), (value) => value?.status === 'draft')
  await confirmDraft(plan.id)
  const exported = await exportPlan(plan.id, 'pdf')
  const token = tokenFromUrl(exported.fileUrl)

  await mutateStore((draft) => {
    const target = draft.plans.find((item) => item.id === plan.id)
    target.exports[0].expiresAt = '2026-06-20T00:00:00.000Z'
  })

  await assert.rejects(
    () => readExportDownload(exported.filename, token),
    (error) => error.code === 'NOT_FOUND' && error.status === 404,
  )
})

async function seedCompany() {
  await mutateStore((draft) => {
    draft.users.push(otherUser)
    draft.companies.push({
      id: 'company_export_storage',
      userId: owner.id,
      name: 'Storage Test Company',
      url: 'https://storage.example/',
      prefecture: '東京都',
      city: '千代田区',
      profile: {
        id: 'profile_export_storage',
        name: 'Storage Test Company',
        businessSummary: '宿泊運営とAI業務自動化を行う会社です。',
        keywords: ['宿泊運営', 'AI業務自動化', '省力化'],
        citations: [{ url: 'https://storage.example/', label: '開発用公式サイト' }],
        unknowns: [],
      },
      sourceCitations: [],
      analyzedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    })
  })
}

async function confirmDraft(planId) {
  return confirmBusinessPlanDraft(planId, {
    draftResponsibility: true,
    sourceReview: true,
    noDelegatedFiling: true,
  })
}

function configureUser(user) {
  configureServicePorts({
    AuthProvider: {
      currentUser: () => user,
    },
  })
}

function tokenFromUrl(fileUrl) {
  return new URL(fileUrl, 'http://local.invalid').searchParams.get('token')
}

async function waitFor(load, predicate, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs
  let value
  while (Date.now() < deadline) {
    value = await load()
    if (predicate(value)) return value
    if (value?.status === 'failed') {
      throw new Error(JSON.stringify(value.error || value))
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error(`Timed out waiting for condition. Last value: ${JSON.stringify(value)}`)
}
