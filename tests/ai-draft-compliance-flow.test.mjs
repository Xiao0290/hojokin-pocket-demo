import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test, { after, beforeEach } from 'node:test'

const testRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'hojokin-pocket-ai-draft-'))
process.env.RUNTIME_DIR = path.join(testRoot, 'runtime')
process.env.EXPORT_DIR = path.join(testRoot, 'exports')

const services = await import('../server/services.mjs')
const store = await import('../server/store.mjs')
const { activeSubsidyRounds } = await import('../server/fixtures.mjs')
const { buildPlanSectionsLocalMock } = await import('../server/planTemplates.mjs')

const {
  confirmBusinessPlanDraft,
  configureServicePorts,
  createBusinessPlan,
  exportPlan,
  getPlan,
  resetServicePorts,
} = services
const { loadStore, mutateStore, resetStore } = store

const round = activeSubsidyRounds.find((item) => item.roundId === 'shoryokuka-ippan-7')
const profile = {
  name: '株式会社サンプル商会',
  prefecture: '東京都',
  city: '新宿区',
  businessSummary: '株式会社サンプル商会は宿泊運営とAI業務自動化に取り組む事業者です。',
  keywords: ['宿泊運営', 'AI業務自動化', '省力化'],
  unknowns: ['従業員数', '投資予定額'],
  citations: [{ url: 'https://www.sample-corp.example', label: '会社公式サイト' }],
}

after(async () => {
  resetServicePorts()
  await fs.rm(testRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 })
})

beforeEach(async () => {
  resetServicePorts()
  await resetStore()
  await seedCompany()
})

test('business plan creation returns before LLM sections are generated', async () => {
  let invoked = false
  let releaseGeneration
  const gate = new Promise((resolve) => {
    releaseGeneration = resolve
  })
  configureServicePorts({
    PlanGenerator: {
      provenance: () => ({
        provider: 'test_llm',
        mode: 'delayed_test_generation',
        model: 'test-model',
        llm: true,
        adapter: 'PlanGenerator.testDelayed',
        phase: 'issue_72',
      }),
      createSections: async ({ profile: inputProfile, round: inputRound, targetChars }) => {
        invoked = true
        await gate
        return buildPlanSectionsLocalMock(inputProfile, inputRound, { targetChars })
      },
    },
  })

  const startedAt = Date.now()
  const planStart = await createBusinessPlan({
    companyId: 'company_ai_draft_test',
    roundId: round.roundId,
    targetChars: 4200,
  })
  const elapsedMs = Date.now() - startedAt
  assert.equal(planStart.status, 'generating')
  assert.equal(elapsedMs < 100, true, `createBusinessPlan should not wait for LLM; elapsed=${elapsedMs}ms`)

  const queued = await getPlan(planStart.planId)
  assert.equal(queued.status, 'generating')
  assert.equal(queued.sections.length, 0)
  assert.equal(queued.events.some((event) => event.event === 'plan.generation.queued'), true)

  await waitFor(() => invoked, Boolean)
  releaseGeneration()
  const completed = await waitFor(
    () => getPlan(planStart.planId),
    (value) => value?.status === 'draft',
  )
  assert.equal(completed.sections.length, 5)
  assert.equal(completed.events.some((event) => event.event === 'plan.generation.started'), true)
  assert.equal(completed.events.some((event) => event.event === 'plan.completed'), true)
})

test('business plan generation failure emits plan.error instead of sticking in generating', async () => {
  configureServicePorts({
    PlanGenerator: {
      provenance: () => ({
        provider: 'test_llm',
        mode: 'failing_test_generation',
        model: 'test-model',
        llm: true,
        adapter: 'PlanGenerator.testFailure',
        phase: 'issue_72',
      }),
      createSections: async () => {
        throw Object.assign(new Error('test generator failed'), { code: 'TEST_PLAN_GENERATOR_FAILED' })
      },
    },
  })

  const planStart = await createBusinessPlan({
    companyId: 'company_ai_draft_test',
    roundId: round.roundId,
    targetChars: 4200,
  })
  const failed = await waitFor(
    () => getPlan(planStart.planId),
    (value) => value?.status === 'failed',
  )
  assert.equal(failed.error.code, 'TEST_PLAN_GENERATOR_FAILED')
  assert.equal(failed.events.some((event) => event.event === 'plan.error'), true)
})

test('Claude CLI provider failure falls back without exposing raw command text', async () => {
  configureServicePorts({
    PlanGenerator: {
      provenance: () => ({
        provider: 'claude_cli',
        mode: 'structured_json_plan',
        model: 'haiku',
        llm: true,
        adapter: 'PlanGenerator.claudeCli',
        phase: 'phase2_local_subscription_llm',
      }),
      createSections: async () => {
        throw Object.assign(
          new Error('Command failed: claude --system-prompt secret {"company":"do-not-leak"}'),
          { code: 'CLAUDE_CLI_PROCESS_FAILED' },
        )
      },
    },
  })

  const planStart = await createBusinessPlan({
    companyId: 'company_ai_draft_test',
    roundId: round.roundId,
    targetChars: 4200,
  })
  const completed = await waitFor(
    () => getPlan(planStart.planId),
    (value) => value?.status === 'draft',
  )

  assert.equal(completed.sections.length, 5)
  assert.equal(completed.generation.provider, 'claude_cli')
  assert.equal(completed.generation.llm, false)
  assert.equal(completed.generation.fallback.code, 'CLAUDE_CLI_PROCESS_FAILED')
  assert.doesNotMatch(completed.generation.fallback.message, /Command failed|do-not-leak|system-prompt/)
  assert.equal(completed.events.some((event) => event.event === 'plan.completed'), true)
})

test('business plan draft confirmation is stored with applicant responsibility evidence', async () => {
  const planStart = await createBusinessPlan({
    companyId: 'company_ai_draft_test',
    roundId: round.roundId,
    targetChars: 4200,
  })
  const plan = await waitFor(
    () => getPlan(planStart.planId),
    (value) => value?.status === 'draft',
  )

  const confirmation = await confirmBusinessPlanDraft(plan.id, {
    draftResponsibility: true,
    sourceReview: true,
    noDelegatedFiling: true,
  })

  assert.equal(confirmation.type, 'business_plan_draft_review')
  assert.equal(confirmation.planId, plan.id)
  assert.deepEqual(confirmation.confirmedFields, ['draftResponsibility', 'sourceReview', 'noDelegatedFiling'])

  const latest = await getPlan(plan.id)
  assert.equal(latest.applicantDraftConfirmation.id, confirmation.id)
  assert.equal(latest.events.some((event) => event.event === 'plan.confirmation.updated'), true)

  const snapshot = await loadStore()
  assert.equal(snapshot.applicantConfirmations.some((item) => item.id === confirmation.id), true)
  const audit = snapshot.auditLogs.find((event) => (
    event.event === 'confirmation.updated' &&
    event.payload?.confirmationType === 'business_plan_draft_review'
  ))
  assert.ok(audit)
  assert.equal(audit.payload.planId, plan.id)
})

test('business plan draft confirmation requires all applicant review acknowledgements', async () => {
  const planStart = await createBusinessPlan({
    companyId: 'company_ai_draft_test',
    roundId: round.roundId,
    targetChars: 4200,
  })
  const plan = await waitFor(
    () => getPlan(planStart.planId),
    (value) => value?.status === 'draft',
  )

  await assert.rejects(
    () => confirmBusinessPlanDraft(plan.id, {
      draftResponsibility: true,
      sourceReview: false,
      noDelegatedFiling: true,
    }),
    /本人確認事項/,
  )
})

test('business plan export is blocked until applicant draft confirmation is logged', async () => {
  const planStart = await createBusinessPlan({
    companyId: 'company_ai_draft_test',
    roundId: round.roundId,
    targetChars: 4200,
  })
  const plan = await waitFor(
    () => getPlan(planStart.planId),
    (value) => value?.status === 'draft',
  )

  await assert.rejects(
    () => exportPlan(plan.id, 'docx'),
    (error) => error.code === 'DRAFT_CONFIRMATION_REQUIRED' && error.status === 409,
  )

  await confirmBusinessPlanDraft(plan.id, {
    draftResponsibility: true,
    sourceReview: true,
    noDelegatedFiling: true,
  })
  const exported = await exportPlan(plan.id, 'docx')
  assert.equal(exported.disclaimerIncluded, true)
})

async function seedCompany() {
  await mutateStore((draft) => {
    draft.companies.push({
      id: 'company_ai_draft_test',
      userId: 'usr_dev_owner',
      name: profile.name,
      url: profile.citations[0].url,
      prefecture: profile.prefecture,
      city: profile.city,
      profile,
      sourceCitations: profile.citations,
      analyzedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    })
  })
}

async function waitFor(load, predicate, { timeoutMs = 3000 } = {}) {
  const started = Date.now()
  let value
  while (Date.now() - started < timeoutMs) {
    value = typeof load === 'function' ? await load() : load
    if (predicate(value)) return value
    await new Promise((resolve) => setTimeout(resolve, 30))
  }
  throw new Error(`Timed out waiting for condition. Last value: ${JSON.stringify(value)}`)
}
