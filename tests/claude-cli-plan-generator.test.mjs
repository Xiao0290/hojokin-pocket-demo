import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test, { after, beforeEach } from 'node:test'

const testRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'hojokin-pocket-claude-cli-'))
process.env.RUNTIME_DIR = path.join(testRoot, 'runtime')
process.env.EXPORT_DIR = path.join(testRoot, 'exports')

const { createClaudeCliPlanGenerator, invokeClaudeCli } = await import('../server/claudeCliPlanGenerator.mjs')
const { readLlmUsageRecords } = await import('../server/llmCostGuard.mjs')
const { activeSubsidyRounds } = await import('../server/fixtures.mjs')

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
  await fs.rm(testRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 })
})

beforeEach(async () => {
  await fs.rm(path.join(testRoot, 'runtime', 'llm-usage.jsonl'), { force: true })
})

test('Claude CLI generator requires explicit paid local provider budget config', () => {
  assert.throws(
    () => createClaudeCliPlanGenerator({
      env: {
        LLM_PROVIDER: 'claude_cli',
        CLAUDE_CLI_MODEL: 'sonnet',
      },
    }),
    /LLM_DAILY_BUDGET_USD/,
  )
})

test('Claude CLI generator records CLI usage and returns structured plan sections', async () => {
  const ledgerPath = path.join(testRoot, 'runtime', 'llm-usage.jsonl')
  const generator = createClaudeCliPlanGenerator({
    env: claudeCliEnv({
      LLM_USAGE_LEDGER_PATH: ledgerPath,
      LLM_MAX_REQUEST_USD: '1',
      LLM_MAX_OUTPUT_TOKENS: '1200',
    }),
    invokeClaude: async () => validClaudeCliResponse(),
  })

  const sections = await generator.createSections({
    profile,
    round,
    targetChars: 4200,
    planId: 'plan_claude_cli_test',
    companyId: 'company_claude_cli_test',
    diagnosisId: 'diag_claude_cli_test',
  })

  assert.equal(sections.length, 5)
  assert.equal(sections[0].templateId, 'labor-saving')
  assert.equal(sections[0].body.includes('Claude CLI下書き'), true)
  assert.equal(sections.generation.provider, 'claude_cli')
  assert.equal(sections.generation.adapter, 'PlanGenerator.claudeCli')
  assert.equal(sections.generation.productionReady, false)
  assert.equal(sections.generation.llm, true)
  assert.equal(sections.generation.usage.inputTokens, 230)
  assert.equal(sections.generation.usage.outputTokens, 480)
  assert.equal(sections.generation.usage.actualCostUsd, 0.01234)

  const records = await readLlmUsageRecords(ledgerPath)
  assert.equal(records.length, 1)
  assert.equal(records[0].provider, 'claude_cli')
  assert.equal(records[0].modelId, 'sonnet')
  assert.equal(records[0].status, 'completed')
  assert.equal(records[0].inputTokens, 230)
  assert.equal(records[0].outputTokens, 480)
  assert.equal(records[0].actualCostUsd, 0.01234)
  assert.equal(records[0].metadata.sessionId, 'session_claude_cli_test')
})

test('Claude CLI generator records provider errors before service fallback', async () => {
  const ledgerPath = path.join(testRoot, 'runtime', 'llm-usage.jsonl')
  const generator = createClaudeCliPlanGenerator({
    env: claudeCliEnv({
      LLM_USAGE_LEDGER_PATH: ledgerPath,
      LLM_MAX_REQUEST_USD: '1',
    }),
    invokeClaude: async () => {
      throw Object.assign(new Error('Claude CLI unavailable'), { code: 'CLAUDE_CLI_UNAVAILABLE' })
    },
  })

  await assert.rejects(
    () => generator.createSections({ profile, round, targetChars: 4200 }),
    /Claude CLI unavailable/,
  )

  const records = await readLlmUsageRecords(ledgerPath)
  assert.equal(records.length, 1)
  assert.equal(records[0].provider, 'claude_cli')
  assert.equal(records[0].status, 'provider_error')
  assert.equal(records[0].actualCostUsd, 0)
  assert.equal(records[0].metadata.errorCode, 'CLAUDE_CLI_UNAVAILABLE')
  assert.equal(records[0].metadata.fallback, true)
})

test('Claude CLI generator records actual spend when CLI budget stop is exceeded', async () => {
  const ledgerPath = path.join(testRoot, 'runtime', 'llm-usage.jsonl')
  const generator = createClaudeCliPlanGenerator({
    env: claudeCliEnv({
      LLM_USAGE_LEDGER_PATH: ledgerPath,
      LLM_MAX_REQUEST_USD: '1',
    }),
    invokeClaude: async () => {
      throw Object.assign(new Error('Reached maximum budget'), {
        code: 'CLAUDE_CLI_BUDGET_EXCEEDED',
        details: {
          response: {
            subtype: 'error_max_budget_usd',
            terminal_reason: 'completed',
            total_cost_usd: 0.1661489,
            usage: {
              input_tokens: 3,
              cache_creation_input_tokens: 5453,
              cache_read_input_tokens: 0,
              output_tokens: 3560,
            },
          },
        },
      })
    },
  })

  await assert.rejects(
    () => generator.createSections({ profile, round, targetChars: 4200 }),
    /Reached maximum budget/,
  )

  const records = await readLlmUsageRecords(ledgerPath)
  assert.equal(records.length, 1)
  assert.equal(records[0].provider, 'claude_cli')
  assert.equal(records[0].status, 'budget_exceeded')
  assert.equal(records[0].actualCostUsd, 0.166149)
  assert.equal(records[0].inputTokens, 5456)
  assert.equal(records[0].outputTokens, 3560)
  assert.equal(records[0].metadata.errorCode, 'CLAUDE_CLI_BUDGET_EXCEEDED')
  assert.equal(records[0].metadata.responseSubtype, 'error_max_budget_usd')
  assert.equal(records[0].metadata.fallback, true)
})

test('Claude CLI budget config defaults to low-cost local model when unspecified', () => {
  const generator = createClaudeCliPlanGenerator({
    env: {
      LLM_PROVIDER: 'claude_cli',
      LLM_DAILY_BUDGET_USD: '5',
      LLM_MONTHLY_BUDGET_USD: '50',
      LLM_MAX_REQUEST_USD: '0.25',
      LLM_USAGE_LEDGER_PATH: path.join(testRoot, 'runtime', 'llm-usage.jsonl'),
    },
    invokeClaude: async () => validClaudeCliResponse(),
  })

  assert.equal(generator.provenance().model, 'haiku')
})

test('Claude CLI invocation sends prompt through stdin', async () => {
  const command = await writeClaudeCliFixture('stdin-ok')
  const result = await invokeClaudeCli({
    config: {
      modelId: 'haiku',
      maxRequestUsd: 0.25,
    },
    prompt: {
      system: 'System prompt fixture',
      user: '{"secret":"stdin-prompt-fixture"}',
    },
    env: {
      CLAUDE_CLI_COMMAND: command,
      CLAUDE_CLI_TIMEOUT_MS: '5000',
    },
  })

  const payload = JSON.parse(result.result)
  assert.equal(payload.stdin, '{"secret":"stdin-prompt-fixture"}')
  assert.deepEqual(payload.args.includes('{"secret":"stdin-prompt-fixture"}'), false)
  assert.deepEqual(payload.args.includes('--input-format'), true)
})

test('Claude CLI process failures do not expose raw command text', async () => {
  const command = await writeClaudeCliFixture('process-fail')

  await assert.rejects(
    () => invokeClaudeCli({
      config: {
        modelId: 'haiku',
        maxRequestUsd: 0.25,
      },
      prompt: {
        system: 'System prompt fixture',
        user: '{"secret":"do-not-leak-this-prompt"}',
      },
      env: {
        CLAUDE_CLI_COMMAND: command,
        CLAUDE_CLI_TIMEOUT_MS: '5000',
        CLAUDE_FIXTURE_FAIL: '1',
      },
    }),
    (error) => {
      assert.equal(error.code, 'CLAUDE_CLI_PROCESS_FAILED')
      assert.equal(error.message, 'Claude CLI generation failed')
      assert.doesNotMatch(String(error.stderr || ''), /do-not-leak-this-prompt|Command failed: claude/)
      return true
    },
  )
})

function claudeCliEnv(overrides = {}) {
  return {
    LLM_PROVIDER: 'claude_cli',
    CLAUDE_CLI_MODEL: 'sonnet',
    LLM_DAILY_BUDGET_USD: '5',
    LLM_MONTHLY_BUDGET_USD: '50',
    LLM_MAX_REQUEST_USD: '0.25',
    LLM_MAX_OUTPUT_TOKENS: '1200',
    LLM_USAGE_LEDGER_PATH: path.join(testRoot, 'runtime', 'llm-usage.jsonl'),
    ...overrides,
  }
}

function validClaudeCliResponse() {
  return {
    type: 'result',
    subtype: 'success',
    is_error: false,
    result: JSON.stringify({
      sections: [1, 2, 3, 4, 5].map((chapterNo) => ({
        chapterNo,
        heading: `Claude CLI章${chapterNo}`,
        body: `株式会社サンプル商会向けのClaude CLI下書きです。第${chapterNo}章では公開情報と制度要件に基づき、本人確認が必要な数値は推測せず整理します。`,
        status: chapterNo % 2 === 0 ? 'needs_confirmation' : 'ai_draft',
        needsConfirmation: chapterNo % 2 === 0,
        confirmationFlags: ['投資予定額', '見積状況'],
        requiredDocumentRefs: ['見積書', '会社概要'],
      })),
    }),
    session_id: 'session_claude_cli_test',
    stop_reason: 'end_turn',
    terminal_reason: 'completed',
    total_cost_usd: 0.01234,
    usage: {
      input_tokens: 200,
      cache_creation_input_tokens: 10,
      cache_read_input_tokens: 20,
      output_tokens: 480,
    },
  }
}

async function writeClaudeCliFixture(name) {
  const scriptPath = path.join(testRoot, `${name}.mjs`)
  await fs.writeFile(scriptPath, `#!/usr/bin/env node
const chunks = []
for await (const chunk of process.stdin) chunks.push(chunk)
const stdin = Buffer.concat(chunks).toString('utf8')
if (process.env.CLAUDE_FIXTURE_FAIL === '1') {
  console.error('Command failed: claude --system-prompt secret --max-budget-usd 0.25 {"secret":"do-not-leak-this-prompt"}')
  process.exit(2)
}
console.log(JSON.stringify({
  type: 'result',
  subtype: 'success',
  is_error: false,
  result: JSON.stringify({ stdin, args: process.argv.slice(2) }),
  session_id: 'fixture_session',
  stop_reason: 'end_turn',
  terminal_reason: 'completed',
  total_cost_usd: 0,
  usage: { input_tokens: 1, output_tokens: 1 }
}))
`)
  await fs.chmod(scriptPath, 0o755)
  return scriptPath
}
