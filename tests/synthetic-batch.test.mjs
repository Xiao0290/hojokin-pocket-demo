import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test, { after } from 'node:test'
import { syntheticCompanyScenarios } from '../data/fixtures/synthetic-companies.mjs'

process.env.SYNTHETIC_FIXTURE_MODE = '1'
const testRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'hojokin-pocket-synthetic-'))
process.env.RUNTIME_DIR = path.join(testRoot, 'runtime')
process.env.EXPORT_DIR = path.join(testRoot, 'exports')

const {
  confirmBusinessPlanDraft,
  createBusinessPlan,
  createDiagnosis,
  exportPlan,
  getDiagnosis,
  getMatches,
  getPlan,
  patchPlanSection,
  recommendExperts,
  updateApplicantConfirmations,
} = await import('../server/services.mjs')
const { resetStore } = await import('../server/store.mjs')

after(async () => {
  await fs.rm(testRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 })
})

test('synthetic company batch covers diagnosis, matching, expert candidates, plan, and export', async () => {
  await resetStore()
  assert.equal(syntheticCompanyScenarios.length, 15)

  const started = await Promise.all(syntheticCompanyScenarios.map(async (fixture) => ({
    fixture,
    start: await createDiagnosis(fixture.url, { attested: true }),
  })))

  const completed = await Promise.all(started.map(async ({ fixture, start }) => ({
    fixture,
    diagnosis: await waitFor(
      () => getDiagnosis(start.diagnosisId),
      (value) => value?.status === 'done',
      12_000,
    ),
  })))

  for (const { fixture, diagnosis } of completed) {
    assert.equal(diagnosis.company.name, fixture.profile.name, `${fixture.id} should use its fixture profile`)
    for (const keyword of fixture.expected.requiredKeywords) {
      assert.ok(diagnosis.company.keywords.includes(keyword), `${fixture.id} should include keyword ${keyword}`)
    }

    const matchesResult = await getMatches(diagnosis.id)
    assert.ok(
      matchesResult.matches.length >= fixture.expected.minMatches,
      `${fixture.id} should return at least ${fixture.expected.minMatches} matches`,
    )
    assert.equal(
      matchesResult.matches[0].roundId,
      fixture.expected.primaryRoundId,
      `${fixture.id} should rank expected primary round first`,
    )
    assert.ok(
      matchesResult.matches[0].scoreBreakdown.total10 >= fixture.expected.minTopTotal10,
      `${fixture.id} top total10 should be >= ${fixture.expected.minTopTotal10}`,
    )
    assert.ok(
      matchesResult.matches[0].warnings.length > 0,
      `${fixture.id} should preserve hard-rule confirmation warnings`,
    )

    const expertResult = await recommendExperts({
      diagnosisId: diagnosis.id,
      roundId: matchesResult.matches[0].roundId,
      limit: 4,
    })
    assert.ok(expertResult.disclaimer.includes('候補専門家'), `${fixture.id} should return expert disclaimer`)
    assert.ok(expertResult.recommendations.length >= 3, `${fixture.id} should return expert candidates`)
    assert.ok(
      expertResult.recommendations.every((expert) => expert.caveats.length >= 2 && expert.sourceUrl.startsWith('https://')),
      `${fixture.id} expert candidates should keep source and caveats`,
    )
  }

  const completedById = new Map(completed.map((item) => [item.fixture.id, item]))
  const needsConfirmationResult = await getMatches(completedById.get('quiet-holding').diagnosis.id)
  assert.equal(
    needsConfirmationResult.matches[0].hardRuleStatus,
    'needs_confirmation',
    'low-information synthetic company should remain needs-confirmation without applicant answers',
  )

  const eligibleResult = await updateApplicantConfirmations(completedById.get('matsuri-market').diagnosis.id, {
    answers: {
      prefecture: '福岡県',
      city: '福岡市',
      employeeCount: 4,
      capitalYen: 3_000_000,
      businessType: 'small_business',
      plannedInvestmentYen: 1_200_000,
      estimateStatus: 'requested',
      gBizIDReadiness: 'ready',
      targetTiming: 'after_3_months',
    },
  })
  assert.equal(
    eligibleResult.matches[0].hardRuleStatus,
    'eligible',
    'complete applicant answers should allow eligible hard-rule status before soft ranking',
  )
  assert.equal(eligibleResult.matches[0].hardRule.confirmedFields.includes('employeeCount'), true)
  assert.ok(eligibleResult.matches[0].softFit.score >= 8)

  const mismatchResult = await updateApplicantConfirmations(completedById.get('sakura-stay').diagnosis.id, {
    answers: {
      prefecture: '京都府',
      city: '京都市',
      employeeCount: 850,
      capitalYen: 1_000_000_000,
      businessType: 'large_company',
      plannedInvestmentYen: 2_500_000,
      estimateStatus: 'obtained',
      gBizIDReadiness: 'ready',
      targetTiming: 'within_3_months',
    },
  })
  assert.equal(
    mismatchResult.matches[0].hardRuleStatus,
    'mismatch',
    'large-company applicant answers should put hard-rule mismatches ahead of soft fit interpretation',
  )
  assert.ok(mismatchResult.matches[0].hardRule.warnings.some((warning) => warning.includes('大企業')))

  const representatives = [
    'sakura-stay',
    'kitsune-cloud',
    'matsuri-market',
    'takumi-succession',
  ]

  for (const id of representatives) {
    const { fixture, diagnosis } = completedById.get(id)
    const matchesResult = await getMatches(diagnosis.id)
    const topMatch = matchesResult.matches[0]

    const planStart = await createBusinessPlan({
      companyId: diagnosis.company.id,
      roundId: topMatch.roundId,
      targetChars: 4200,
    })
    const plan = await waitFor(() => getPlan(planStart.planId), (value) => value?.status === 'draft', 20_000)
    assert.ok(plan.sections.length >= 5, `${fixture.id} should have draft sections`)

    const edited = await patchPlanSection(plan.id, 1, `${plan.sections[0].body}\nSynthetic batch edit: ${fixture.id}`, 'edited')
    assert.equal(edited.status, 'edited')

    await confirmDraft(plan.id)
    const docx = await exportPlan(plan.id, 'docx')
    const pdf = await exportPlan(plan.id, 'pdf')
    assert.equal(docx.disclaimerIncluded, true)
    assert.equal(pdf.disclaimerIncluded, true)
    assert.ok(docx.storageKey.endsWith('.docx'))
    assert.ok(pdf.storageKey.endsWith('.pdf'))
    assert.equal(docx.filePath, undefined)
    assert.equal(pdf.filePath, undefined)
    assert.match(docx.fileUrl, /token=/)
    assert.match(pdf.fileUrl, /token=/)
  }
})

async function confirmDraft(planId) {
  return confirmBusinessPlanDraft(planId, {
    draftResponsibility: true,
    sourceReview: true,
    noDelegatedFiling: true,
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
