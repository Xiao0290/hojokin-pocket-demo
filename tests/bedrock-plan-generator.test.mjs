import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test, { after, beforeEach } from 'node:test'

const testRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'hojokin-pocket-bedrock-'))
process.env.RUNTIME_DIR = path.join(testRoot, 'runtime')
process.env.EXPORT_DIR = path.join(testRoot, 'exports')

const { createBedrockPlanGenerator } = await import('../server/bedrockPlanGenerator.mjs')
const { getLlmBillingSummary, readLlmUsageRecords } = await import('../server/llmCostGuard.mjs')
const { activeSubsidyRounds } = await import('../server/fixtures.mjs')
const services = await import('../server/services.mjs')
const store = await import('../server/store.mjs')

const {
  configureServicePorts,
  createBusinessPlan,
  getPlan,
  getLlmUsageSummary,
  resetServicePorts,
} = services
const { mutateStore, resetStore } = store

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
  await fs.rm(path.join(testRoot, 'runtime', 'llm-usage.jsonl'), { force: true })
})

test('Bedrock generator refuses to start without explicit budget guard config', () => {
  assert.throws(
    () => createBedrockPlanGenerator({
      env: {
        LLM_PROVIDER: 'bedrock',
        BEDROCK_MODEL_ID: 'apac.anthropic.claude-3-5-sonnet-20241022-v2:0',
        AWS_REGION: 'ap-northeast-1',
      },
    }),
    /LLM_DAILY_BUDGET_USD/,
  )
})

test('Bedrock budget guard denies oversized requests before invoking the model', async () => {
  let invoked = false
  const generator = createBedrockPlanGenerator({
    env: bedrockEnv({
      LLM_MAX_REQUEST_USD: '0.001',
      LLM_MAX_OUTPUT_TOKENS: '2000',
    }),
    invokeBedrock: async () => {
      invoked = true
      return validBedrockResponse()
    },
  })

  await assert.rejects(
    () => generator.createSections({ profile, round, targetChars: 4200 }),
    /per-request cap/,
  )
  assert.equal(invoked, false)
  const records = await readLlmUsageRecords(path.join(testRoot, 'runtime', 'llm-usage.jsonl'))
  assert.equal(records.length, 1)
  assert.equal(records[0].status, 'budget_denied')
  assert.equal(records[0].actualCostUsd, 0)
  assert.equal(records[0].estimatedCostUsd > 0, true)
})

test('Bedrock generator records usage and returns structured plan sections', async () => {
  const ledgerPath = path.join(testRoot, 'runtime', 'llm-usage.jsonl')
  const generator = createBedrockPlanGenerator({
    env: bedrockEnv({
      LLM_USAGE_LEDGER_PATH: ledgerPath,
      LLM_MAX_REQUEST_USD: '1',
      LLM_MAX_OUTPUT_TOKENS: '1200',
    }),
    invokeBedrock: async () => validBedrockResponse(),
  })

  const sections = await generator.createSections({ profile, round, targetChars: 4200 })
  assert.equal(sections.length, 5)
  assert.equal(sections[0].templateId, 'labor-saving')
  assert.equal(sections.generation.provider, 'bedrock')
  assert.equal(sections.generation.llm, true)
  assert.equal(sections.generation.usage.inputTokens, 900)
  assert.equal(sections.generation.usage.outputTokens, 500)

  const records = await readLlmUsageRecords(ledgerPath)
  assert.equal(records.length, 1)
  assert.equal(records[0].status, 'completed')
  assert.equal(records[0].modelId, 'apac.anthropic.claude-3-5-sonnet-20241022-v2:0')
  assert.equal(records[0].actualCostUsd > 0, true)

  const summary = await getLlmBillingSummary({ env: bedrockEnv({ LLM_USAGE_LEDGER_PATH: ledgerPath }) })
  assert.equal(summary.totals.runCount, 1)
  assert.equal(summary.totals.actualInputTokens, 900)
  assert.equal(summary.totals.actualOutputTokens, 500)
  assert.equal(summary.byStatus.completed.count, 1)
  assert.equal(summary.recentRuns[0].status, 'completed')
})

test('service layer falls back to deterministic template when Bedrock budget denies a call', async () => {
  let invoked = false
  configureServicePorts({
    PlanGenerator: createBedrockPlanGenerator({
      env: bedrockEnv({
        LLM_MAX_REQUEST_USD: '0.001',
        LLM_MAX_OUTPUT_TOKENS: '2000',
      }),
      invokeBedrock: async () => {
        invoked = true
        return validBedrockResponse()
      },
    }),
  })

  await mutateStore((draft) => {
    draft.companies.push({
      id: 'company_bedrock_budget',
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

  const planStart = await createBusinessPlan({
    companyId: 'company_bedrock_budget',
    roundId: round.roundId,
    targetChars: 4200,
  })
  const plan = await waitFor(async () => getPlan(planStart.planId), (value) => value?.status === 'draft')

  assert.equal(invoked, false)
  assert.equal(plan.generation.provider, 'bedrock')
  assert.equal(plan.generation.llm, false)
  assert.equal(plan.generation.adapter, 'PlanGenerator.localMockFallback')
  assert.equal(plan.generation.fallback.code, 'LLM_REQUEST_BUDGET_EXCEEDED')
  assert.equal(plan.sections[0].templateId, 'labor-saving')

  const summary = await getLlmUsageSummary({ env: bedrockEnv({ LLM_MAX_REQUEST_USD: '0.001' }) })
  assert.equal(summary.totals.runCount, 1)
  assert.equal(summary.byStatus.budget_denied.count, 1)
  assert.equal(summary.recentRuns[0].actualCostUsd, 0)
})

test('LLM usage API route is wired as an owner/admin read-only endpoint', async () => {
  const source = await fs.readFile(path.join(process.cwd(), 'server/index.mjs'), 'utf8')
  assert.match(source, /\/v1\/admin\/llm-usage/)
  assert.match(source, /getLlmUsageSummary/)
})

function bedrockEnv(overrides = {}) {
  return {
    LLM_PROVIDER: 'bedrock',
    AWS_REGION: 'ap-northeast-1',
    BEDROCK_MODEL_ID: 'apac.anthropic.claude-3-5-sonnet-20241022-v2:0',
    LLM_DAILY_BUDGET_USD: '5',
    LLM_MONTHLY_BUDGET_USD: '50',
    LLM_MAX_REQUEST_USD: '0.25',
    LLM_MAX_OUTPUT_TOKENS: '1200',
    LLM_USAGE_LEDGER_PATH: path.join(testRoot, 'runtime', 'llm-usage.jsonl'),
    ...overrides,
  }
}

function validBedrockResponse() {
  return {
    output: {
      message: {
        content: [{
          text: JSON.stringify({
            sections: [1, 2, 3, 4, 5].map((chapterNo) => ({
              chapterNo,
              heading: `LLM章${chapterNo}`,
              body: `株式会社サンプル商会向けの省力化投資下書きです。第${chapterNo}章では公開情報と制度要件に基づき、本人確認が必要な数値は推測せず整理します。`,
              status: chapterNo % 2 === 0 ? 'needs_confirmation' : 'ai_draft',
              needsConfirmation: chapterNo % 2 === 0,
              confirmationFlags: ['投資予定額', '見積状況'],
              requiredDocumentRefs: ['見積書', '会社概要'],
            })),
          }),
        }],
      },
    },
    usage: {
      inputTokens: 900,
      outputTokens: 500,
    },
  }
}

async function waitFor(load, predicate, { timeoutMs = 3000 } = {}) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    const value = await load()
    if (predicate(value)) return value
    await new Promise((resolve) => setTimeout(resolve, 40))
  }
  throw new Error('Timed out waiting for condition')
}
