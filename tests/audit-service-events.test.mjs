import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test, { after } from 'node:test'

const testRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'hojokin-audit-service-'))
process.env.RUNTIME_DIR = path.join(testRoot, 'runtime')
process.env.EXPORT_DIR = path.join(testRoot, 'exports')

const services = await import('../server/services.mjs')
const store = await import('../server/store.mjs')

const {
  confirmBusinessPlanDraft,
  configureServicePorts,
  createBusinessPlan,
  createDiagnosis,
  createLead,
  exportPlan,
  getAdminSourceReview,
  getDiagnosis,
  getMatches,
  getPlan,
  patchPlanSection,
  readExportDownload,
  resetServicePorts,
  updateApplicantConfirmations,
} = services
const { loadStore, resetStore } = store

after(async () => {
  resetServicePorts()
  await fs.rm(testRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 })
})

test('service entry points append normalized audit events for minimum closed-beta actions', async () => {
  await resetStore()
  resetServicePorts()
  configureServicePorts({
    DiagnosisExtractor: {
      extract: async (url) => ({
        html: '<html><body>Audit fixture company</body></html>',
        finalUrl: url.href,
        warnings: [],
        profile: {
          id: 'profile_audit_fixture',
          name: 'Audit Fixture株式会社',
          url: url.href,
          prefecture: '東京都',
          city: '千代田区',
          businessSummary: '宿泊運営とAI業務自動化を進める小規模事業者です。',
          pageTitle: 'Audit Fixture',
          headings: [],
          keywords: ['宿泊運営', 'AI業務自動化', '省力化'],
          evidenceSnippets: [
            { keyword: '宿泊運営', snippet: '宿泊運営の省力化に取り組みます。' },
            { keyword: 'AI業務自動化', snippet: 'AI業務自動化を導入します。' },
          ],
          extractionQuality: { score: 9, level: 'usable', missingFields: [] },
          unknowns: [],
          citations: [{ url: url.href, label: 'Audit fixture source' }],
          sourceType: 'test_fixture',
          extractedAt: '2026-06-20T00:00:00.000Z',
        },
      }),
    },
  })

  const started = await createDiagnosis('https://audit-fixture.example', { attested: true })
  const diagnosis = await waitFor(async () => getDiagnosis(started.diagnosisId), (value) => value?.status === 'done')
  const matches = await getMatches(diagnosis.id)
  assert.ok(matches.matches.length > 0)
  const firstMatch = matches.matches[0]

  await updateApplicantConfirmations(diagnosis.id, {
    answers: {
      prefecture: '東京都',
      city: '千代田区',
      employeeCount: 8,
      capitalYen: 5_000_000,
      businessType: 'sme',
      plannedInvestmentYen: 1_500_000,
      estimateStatus: 'obtained',
      gBizIDReadiness: 'ready',
      targetTiming: 'within_3_months',
    },
  })

  const planStart = await createBusinessPlan({
    companyId: diagnosis.company.id,
    roundId: firstMatch.roundId,
    targetChars: 4200,
  })
  const plan = await waitFor(async () => getPlan(planStart.planId), (value) => value?.status === 'draft')
  await patchPlanSection(plan.id, 1, `${plan.sections[0].body}\nAudit edit marker`, 'edited')
  await confirmDraft(plan.id)
  const exportRecord = await exportPlan(plan.id, 'docx')
  const download = await readExportDownload(exportRecord.filename, tokenFromUrl(exportRecord.fileUrl))
  assert.equal(download.body.slice(0, 2).toString('utf8'), 'PK')
  await createLead({
    diagnosisId: diagnosis.id,
    roundId: firstMatch.roundId,
    expertId: 'expert_aoi_gyosei',
    message: 'Please contact owner@example.test',
  })

  configureServicePorts({
    AuthProvider: {
      currentUser: () => ({ id: 'audit_admin', email: 'admin@example.test', role: 'admin' }),
    },
  })
  await getAdminSourceReview({ today: '2026-06-20' })

  const snapshot = await loadStore()
  const eventNames = new Set(snapshot.auditLogs.map((event) => event.event))
  for (const event of [
    'diagnosis.started',
    'diagnosis.completed',
    'diagnosis.viewed',
    'match.viewed',
    'confirmation.updated',
    'business_plan.started',
    'business_plan.completed',
    'business_plan.section_edited',
    'business_plan.exported',
    'file.downloaded',
    'expert_waitlist.submitted',
    'admin.source_reviewed',
  ]) {
    assert.equal(eventNames.has(event), true, `${event} should be appended`)
  }

  const normalized = snapshot.auditLogs.find((event) => event.event === 'business_plan.exported')
  assert.equal(normalized.schemaVersion, 'audit-log.v1')
  assert.equal(normalized.targetType, 'business_plan_export')
  assert.equal(normalized.targetId, exportRecord.id)
  assert.ok(normalized.correlationId)

  const fileDownloadedAudit = snapshot.auditLogs.find((event) => event.event === 'file.downloaded')
  assert.equal(fileDownloadedAudit.targetType, 'exported_file')
  assert.equal(fileDownloadedAudit.targetId, exportRecord.id)
  assert.equal(fileDownloadedAudit.payload.storageKey, exportRecord.storageKey)
  assert.equal(JSON.stringify(fileDownloadedAudit).includes('token='), false)

  const waitlistAudit = snapshot.auditLogs.find((event) => event.event === 'expert_waitlist.submitted')
  assert.equal(JSON.stringify(waitlistAudit).includes('owner@example.test'), false)
  assert.equal(waitlistAudit.payload.leadId.startsWith('lead_'), true)

  const adminAudit = snapshot.auditLogs.find((event) => event.event === 'admin.source_reviewed')
  assert.equal(adminAudit.actorType, 'admin')
  assert.equal(adminAudit.targetId, 'local_admin_source_review')
})

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

function tokenFromUrl(fileUrl) {
  return new URL(fileUrl, 'http://local.invalid').searchParams.get('token')
}

async function confirmDraft(planId) {
  return confirmBusinessPlanDraft(planId, {
    draftResponsibility: true,
    sourceReview: true,
    noDelegatedFiling: true,
  })
}
