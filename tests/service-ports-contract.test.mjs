import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test, { after, beforeEach } from 'node:test'
import {
  SERVICE_PORT_CONTRACTS,
  SERVICE_PORTS,
  assertServicePorts,
  describeServicePorts,
} from '../server/servicePorts.mjs'

const testRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'hojokin-pocket-ports-'))
process.env.RUNTIME_DIR = path.join(testRoot, 'runtime')
process.env.EXPORT_DIR = path.join(testRoot, 'exports')

const services = await import('../server/services.mjs')
const store = await import('../server/store.mjs')

const {
  authUser,
  configureServicePorts,
  createBusinessPlan,
  createDiagnosis,
  createLead,
  devLogin,
  getDiagnosis,
  getMatches,
  getPlan,
  getRound,
  getServicePorts,
  resetServicePorts,
  submitBusinessPlan,
  updateNotificationSettings,
} = services
const { loadStore, mutateStore, resetStore } = store

after(async () => {
  resetServicePorts()
  await fs.rm(testRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 })
})

beforeEach(async () => {
  resetServicePorts()
  await resetStore()
})

test('service ports publish method contracts with responsibilities and shapes', () => {
  assert.deepEqual(Object.keys(SERVICE_PORTS), [
    'SubsidyDataSource',
    'DiagnosisExtractor',
    'PlanGenerator',
    'Matcher',
    'AuthProvider',
    'Notifier',
    'SubmissionAdapter',
  ])

  for (const [portName, methods] of Object.entries(SERVICE_PORTS)) {
    const contract = SERVICE_PORT_CONTRACTS[portName]
    assert.ok(contract.responsibility, `${portName} should document responsibility`)
    for (const method of methods) {
      assert.ok(contract.input[method], `${portName}.${method} should document input shape`)
      assert.ok(contract.output[method], `${portName}.${method} should document output shape`)
    }
  }

  const descriptions = describeServicePorts()
  assert.equal(descriptions.length, 7)
  assert.equal(descriptions.find((item) => item.name === 'SubmissionAdapter').output.submit.includes('blocked'), true)
})

test('service port validation rejects missing adapter methods', () => {
  assert.throws(
    () => assertServicePorts({
      SubsidyDataSource: { listActiveRounds: () => [] },
      DiagnosisExtractor: { extract: async () => ({}) },
      PlanGenerator: { createSections: () => [] },
      Matcher: { match: () => [] },
      AuthProvider: { currentUser: () => ({}), devLogin: async () => ({}) },
      Notifier: { createExpertWaitlistLead: async () => ({}), updateSettings: async () => ({}) },
      SubmissionAdapter: { submit: async () => ({}) },
    }),
    /SubsidyDataSource\.getRound/,
  )
})

test('default local mock adapters preserve auth, notifier, subsidy, and blocked submission behavior', async () => {
  const ports = getServicePorts()
  for (const [portName, methods] of Object.entries(SERVICE_PORTS)) {
    for (const method of methods) {
      assert.equal(typeof ports[portName][method], 'function', `${portName}.${method} should be implemented`)
    }
  }

  const login = await devLogin()
  assert.equal(authUser().id, 'usr_dev_owner')
  assert.equal(login.token, 'dev-token')

  const round = getRound('shoryokuka-ippan-7')
  assert.equal(round.roundId, 'shoryokuka-ippan-7')
  assert.equal(round.daysLeft >= 0, true)

  await mutateStore((draft) => {
    draft.diagnoses.push({
      id: 'diag_local',
      userId: 'usr_dev_owner',
      companyId: 'company_local',
      status: 'done',
      events: [],
    })
  })
  const lead = await createLead({ diagnosisId: 'diag_local', roundId: round.roundId, expertId: 'expert_local' })
  assert.equal(lead.status, 'waitlisted')

  const settings = await updateNotificationSettings({ push: false, email: true })
  assert.equal(settings.push, false)
  assert.equal(settings.email, true)

  const planStart = await createBusinessPlan({
    companyId: 'missing_uses_seed_company',
    roundId: round.roundId,
    targetChars: 4200,
  }).catch((error) => error)
  assert.equal(planStart.code, 'NOT_FOUND')
})

test('service layer calls through injected ports for diagnosis, matching, planning, and submission', async () => {
  const injectedRound = {
    roundId: 'round_injected_port',
    program: {
      id: 'program_injected_port',
      name: 'Injected Port Subsidy',
      issuer: 'LocalMock Test Office',
      sourceUrl: 'https://example.com/subsidy',
      overview: 'Injected source for service port smoke tests.',
    },
    roundLabel: 'Smoke Test Round',
    status: 'open',
    acceptEnd: '2099-12-31T17:00:00+09:00',
    maxLimit: 1234567,
    subsidyRate: '1/2',
    adoptionRate: null,
    adoptionRateSource: null,
    lastSeenAt: '2026-06-20T00:00:00+09:00',
    keywords: ['Injected'],
    requirements: [],
    requiredDocuments: [{ label: 'Injected document', aiDraftable: true, checked: false }],
    steps: ['Injected step'],
  }
  const calls = []

  configureServicePorts({
    SubsidyDataSource: {
      listActiveRounds: () => {
        calls.push('SubsidyDataSource.listActiveRounds')
        return [injectedRound]
      },
      getRound: (roundId) => {
        calls.push(`SubsidyDataSource.getRound:${roundId}`)
        return roundId === injectedRound.roundId ? injectedRound : null
      },
    },
    DiagnosisExtractor: {
      extract: async (url) => {
        calls.push(`DiagnosisExtractor.extract:${url.hostname}`)
        return {
          html: '<html><title>Injected Port Company</title></html>',
          finalUrl: url.href,
          warnings: ['injected diagnosis extractor'],
          profile: {
            id: 'profile_injected_port',
            name: 'Injected Port Company',
            url: url.href,
            prefecture: '東京都',
            city: '千代田区',
            businessSummary: 'Injected profile for port adapter smoke test.',
            pageTitle: 'Injected Port Company',
            headings: [],
            keywords: ['Injected'],
            evidenceSnippets: [],
            extractionQuality: { score: 9.5, level: 'usable', missingFields: [] },
            unknowns: [],
            citations: [{ url: url.href, label: 'Injected extractor' }],
            sourceType: 'local_mock_injected',
            extractedAt: '2026-06-20T00:00:00.000Z',
          },
        }
      },
    },
    Matcher: {
      match: ({ diagnosisId, profile, rounds }) => {
        calls.push(`Matcher.match:${profile.name}:${rounds.length}`)
        return [{
          id: 'match_injected_port',
          diagnosisId,
          roundId: injectedRound.roundId,
          rank: 1,
          eligible: true,
          matchScore: 91,
          confidenceScore: 88,
          programName: injectedRound.program.name,
          roundLabel: injectedRound.roundLabel,
          issuer: injectedRound.program.issuer,
          maxLimit: injectedRound.maxLimit,
          subsidyRate: injectedRound.subsidyRate,
          acceptEnd: injectedRound.acceptEnd,
          daysLeft: 9999,
          reasons: [],
          proposal: { title: 'Injected proposal', summary: 'Injected summary' },
          evidence: { company: [], subsidy: { sourceUrl: injectedRound.program.sourceUrl, requirements: [] } },
          warnings: [],
          lastSeenAt: injectedRound.lastSeenAt,
        }]
      },
    },
    PlanGenerator: {
      createSections: ({ profile, round }) => {
        calls.push(`PlanGenerator.createSections:${profile.name}:${round.roundId}`)
        return [{
          chapterNo: 1,
          heading: 'Injected Plan Section',
          body: `${profile.name} uses ${round.program.name}.`,
          status: 'ai_draft',
          charCount: 58,
          revision: 1,
          sources: [{ url: round.program.sourceUrl, label: 'Injected source' }],
          needsConfirmation: false,
        }]
      },
    },
    SubmissionAdapter: {
      submit: async ({ plan }) => {
        calls.push(`SubmissionAdapter.submit:${plan.id}`)
        return { ok: false, status: 'blocked', reason: 'notConfigured', adapter: 'injected' }
      },
    },
  })

  const diagnosisStart = await createDiagnosis('https://example.com', { attested: true })
  const diagnosis = await waitFor(async () => getDiagnosis(diagnosisStart.diagnosisId), (value) => value?.status === 'done')
  assert.equal(diagnosis.company.name, 'Injected Port Company')
  assert.equal(diagnosis.matchCount, 1)

  const matches = await getMatches(diagnosis.id)
  assert.equal(matches.matches[0].roundId, injectedRound.roundId)

  const planStart = await createBusinessPlan({
    companyId: diagnosis.company.id,
    roundId: injectedRound.roundId,
    targetChars: 4200,
  })
  const plan = await waitFor(async () => getPlan(planStart.planId), (value) => value?.status === 'draft')
  assert.equal(plan.sections[0].heading, 'Injected Plan Section')

  const submission = await submitBusinessPlan(plan.id, { mode: 'test' })
  assert.deepEqual(submission, { ok: false, status: 'blocked', reason: 'notConfigured', adapter: 'injected' })
  assert.ok(calls.includes('SubsidyDataSource.listActiveRounds'))
  assert.ok(calls.includes('DiagnosisExtractor.extract:example.com'))
  assert.ok(calls.some((call) => call.startsWith('Matcher.match:Injected Port Company:1')))
  assert.ok(calls.includes(`PlanGenerator.createSections:Injected Port Company:${injectedRound.roundId}`))
  assert.ok(calls.includes(`SubmissionAdapter.submit:${plan.id}`))
})

test('local SubmissionAdapter never performs operational submission', async () => {
  await seedCompanyForPlan()
  const planStart = await createBusinessPlan({
    companyId: 'company_submit_stub',
    roundId: 'shoryokuka-ippan-7',
    targetChars: 4200,
  })
  const plan = await waitFor(async () => getPlan(planStart.planId), (value) => value?.status === 'draft')

  const result = await submitBusinessPlan(plan.id, { externalTarget: 'jgrants', dryRun: false })
  assert.equal(result.ok, false)
  assert.equal(result.status, 'blocked')
  assert.equal(result.reason, 'notConfigured')
  assert.equal(result.code, 'SUBMISSION_NOT_CONFIGURED')

  const snapshot = await loadStore()
  const audit = snapshot.auditLogs.find((item) => item.event === 'submission.blocked')
  assert.equal(audit.payload.planId, plan.id)
  assert.equal(audit.payload.reason, 'notConfigured')
})

async function seedCompanyForPlan() {
  await store.mutateStore((draft) => {
    draft.companies.push({
      id: 'company_submit_stub',
      userId: 'usr_dev_owner',
      name: '提出スタブ検証株式会社',
      url: 'https://submit-stub.example/',
      prefecture: '東京都',
      city: '千代田区',
      profile: {
        id: 'profile_submit_stub',
        name: '提出スタブ検証株式会社',
        businessSummary: '省力化投資を検討する検証用会社です。',
        keywords: ['省力化', '設備投資'],
        citations: [{ url: 'https://submit-stub.example/', label: '検証用サイト' }],
        unknowns: [],
      },
      sourceCitations: [],
      analyzedAt: '2026-06-20T00:00:00.000Z',
      createdAt: '2026-06-20T00:00:00.000Z',
    })
  })
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
