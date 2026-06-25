import { promises as fs } from 'node:fs'
import path from 'node:path'
import { ensureDirs, nowIso, runtimeDir, writeJson } from './utils.mjs'

const DEFAULT_SONNET_PRICING = Object.freeze({
  inputPerMillionUsd: 3,
  outputPerMillionUsd: 15,
})
const DEFAULT_BEDROCK_MODEL_ID = 'apac.anthropic.claude-3-5-sonnet-20241022-v2:0'
const DEFAULT_CLAUDE_CLI_MODEL_ID = 'haiku'
const PAID_LLM_PROVIDERS = new Set(['bedrock', 'claude_cli'])

export function resolveLlmBudgetConfig(env = process.env) {
  const provider = String(env.LLM_PROVIDER || 'local').toLowerCase()
  const modelId = resolveModelId(provider, env)
  const region = provider === 'claude_cli'
    ? 'local_claude_cli'
    : (env.BEDROCK_REGION || env.AWS_REGION || env.AWS_DEFAULT_REGION || 'ap-northeast-1')
  const maxOutputTokens = parsePositiveInteger(env.LLM_MAX_OUTPUT_TOKENS || 2200, 'LLM_MAX_OUTPUT_TOKENS')
  const maxInputChars = parsePositiveInteger(env.LLM_MAX_INPUT_CHARS || 18000, 'LLM_MAX_INPUT_CHARS')
  const inputPerMillionUsd = parsePositiveNumber(
    env.LLM_INPUT_PRICE_PER_1M_USD || DEFAULT_SONNET_PRICING.inputPerMillionUsd,
    'LLM_INPUT_PRICE_PER_1M_USD',
  )
  const outputPerMillionUsd = parsePositiveNumber(
    env.LLM_OUTPUT_PRICE_PER_1M_USD || DEFAULT_SONNET_PRICING.outputPerMillionUsd,
    'LLM_OUTPUT_PRICE_PER_1M_USD',
  )

  if (!PAID_LLM_PROVIDERS.has(provider)) {
    return {
      provider,
      enabled: false,
      modelId,
      region,
      maxOutputTokens,
      maxInputChars,
      usageLedgerPath: env.LLM_USAGE_LEDGER_PATH || path.join(runtimeDir, 'llm-usage.jsonl'),
      pricing: { inputPerMillionUsd, outputPerMillionUsd },
    }
  }

  return {
    provider,
    enabled: true,
    modelId,
    region,
    maxOutputTokens,
    maxInputChars,
    dailyBudgetUsd: parseRequiredPositiveNumber(env.LLM_DAILY_BUDGET_USD, 'LLM_DAILY_BUDGET_USD'),
    monthlyBudgetUsd: parseRequiredPositiveNumber(env.LLM_MONTHLY_BUDGET_USD, 'LLM_MONTHLY_BUDGET_USD'),
    maxRequestUsd: parseRequiredPositiveNumber(env.LLM_MAX_REQUEST_USD, 'LLM_MAX_REQUEST_USD'),
    usageLedgerPath: env.LLM_USAGE_LEDGER_PATH || path.join(runtimeDir, 'llm-usage.jsonl'),
    pricing: { inputPerMillionUsd, outputPerMillionUsd },
  }
}

export async function assertLlmBudgetAllowed({
  config,
  inputText,
  maxOutputTokens = config.maxOutputTokens,
  now = new Date(),
} = {}) {
  if (!config?.enabled) {
    throw budgetError('LLM_DISABLED', 'A paid LLM provider is required for paid LLM calls')
  }
  const trimmedInput = String(inputText || '').slice(0, config.maxInputChars)
  const estimate = estimateLlmRequestCost({
    inputText: trimmedInput,
    maxOutputTokens,
    pricing: config.pricing,
  })
  const records = await readLlmUsageRecords(config.usageLedgerPath)
  const totals = summarizeUsage(records, now)

  if (estimate.estimatedCostUsd > config.maxRequestUsd) {
    throw budgetError('LLM_REQUEST_BUDGET_EXCEEDED', 'Estimated LLM request cost exceeds per-request cap', {
      estimate,
      maxRequestUsd: config.maxRequestUsd,
    })
  }
  if (totals.todayCostUsd + estimate.estimatedCostUsd > config.dailyBudgetUsd) {
    throw budgetError('LLM_DAILY_BUDGET_EXCEEDED', 'Estimated LLM request cost exceeds daily cap', {
      estimate,
      todayCostUsd: totals.todayCostUsd,
      dailyBudgetUsd: config.dailyBudgetUsd,
    })
  }
  if (totals.monthCostUsd + estimate.estimatedCostUsd > config.monthlyBudgetUsd) {
    throw budgetError('LLM_MONTHLY_BUDGET_EXCEEDED', 'Estimated LLM request cost exceeds monthly cap', {
      estimate,
      monthCostUsd: totals.monthCostUsd,
      monthlyBudgetUsd: config.monthlyBudgetUsd,
    })
  }
  return { allowed: true, estimate, totals }
}

export async function recordLlmUsage(record, ledgerPath) {
  await ensureDirs()
  const normalized = {
    id: record.id || `llm_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    requestId: record.requestId || record.id || null,
    planId: record.planId || null,
    companyId: record.companyId || null,
    diagnosisId: record.diagnosisId || null,
    roundId: record.roundId || record.metadata?.roundId || null,
    templateId: record.templateId || record.metadata?.templateId || null,
    createdAt: record.createdAt || nowIso(),
    provider: record.provider || 'bedrock',
    modelId: record.modelId || null,
    status: record.status || 'completed',
    inputTokens: Number(record.inputTokens || 0),
    outputTokens: Number(record.outputTokens || 0),
    estimatedCostUsd: roundCost(Number(record.estimatedCostUsd || 0)),
    actualCostUsd: roundCost(resolveActualCost(record)),
    currency: record.currency || 'USD',
    requestKind: record.requestKind || 'plan_generation',
    metadata: record.metadata || {},
  }
  const line = `${JSON.stringify(normalized)}\n`
  await fs.mkdir(path.dirname(ledgerPath), { recursive: true })
  await fs.appendFile(ledgerPath, line, 'utf8')
  return normalized
}

export async function readLlmUsageRecords(ledgerPath) {
  try {
    const raw = await fs.readFile(ledgerPath, 'utf8')
    return raw
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line))
  } catch (error) {
    if (error.code === 'ENOENT') return []
    throw error
  }
}

export async function resetLlmUsageLedger(ledgerPath) {
  await writeJson(`${ledgerPath}.reset-marker.json`, { resetAt: nowIso() })
  await fs.rm(ledgerPath, { force: true })
}

export function summarizeUsage(records = [], now = new Date()) {
  const dayKey = toDayKey(now)
  const monthKey = toMonthKey(now)
  return records
    .filter((record) => Number(record.actualCostUsd || 0) > 0 || record.status === 'completed' || record.status === 'invalid_output')
    .reduce((totals, record) => {
      const createdAt = new Date(record.createdAt || 0)
      const cost = Number(record.actualCostUsd || record.estimatedCostUsd || 0)
      if (toDayKey(createdAt) === dayKey) totals.todayCostUsd += cost
      if (toMonthKey(createdAt) === monthKey) totals.monthCostUsd += cost
      totals.allTimeCostUsd += cost
      return totals
    }, { todayCostUsd: 0, monthCostUsd: 0, allTimeCostUsd: 0 })
}

export async function getLlmBillingSummary({
  env = process.env,
  now = new Date(),
  limit = 20,
} = {}) {
  const config = resolveLlmBudgetConfigForSummary(env)
  const records = await readLlmUsageRecords(config.usageLedgerPath)
  return buildLlmBillingSummary({ config, records, now, limit })
}

export function buildLlmBillingSummary({ config, records = [], now = new Date(), limit = 20 } = {}) {
  const totals = summarizeUsage(records, now)
  const byStatus = {}
  const byModel = {}
  let estimatedAllTimeCostUsd = 0
  let attemptedInputTokens = 0
  let attemptedOutputTokens = 0
  let actualInputTokens = 0
  let actualOutputTokens = 0

  for (const record of records) {
    const status = record.status || 'unknown'
    const modelId = record.modelId || 'unknown'
    const estimatedCostUsd = Number(record.estimatedCostUsd || 0)
    const actualCostUsd = Number(record.actualCostUsd || 0)
    const inputTokens = Number(record.inputTokens || 0)
    const outputTokens = Number(record.outputTokens || 0)
    estimatedAllTimeCostUsd += estimatedCostUsd
    attemptedInputTokens += inputTokens
    attemptedOutputTokens += outputTokens
    if (actualCostUsd > 0) {
      actualInputTokens += inputTokens
      actualOutputTokens += outputTokens
    }
    byStatus[status] = incrementRollup(byStatus[status], { estimatedCostUsd, actualCostUsd, inputTokens, outputTokens })
    byModel[modelId] = incrementRollup(byModel[modelId], { estimatedCostUsd, actualCostUsd, inputTokens, outputTokens })
  }

  const recentRuns = [...records]
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
    .slice(0, limit)
    .map(publicUsageRecord)

  return {
    schema: 'hojokin-pocket.llm-billing-summary.v1',
    generatedAt: nowIso(),
    provider: config.provider,
    enabled: Boolean(config.enabled),
    modelId: config.modelId,
    region: config.region,
    pricing: config.pricing,
    budget: {
      dailyBudgetUsd: config.dailyBudgetUsd || null,
      monthlyBudgetUsd: config.monthlyBudgetUsd || null,
      maxRequestUsd: config.maxRequestUsd || null,
      maxOutputTokens: config.maxOutputTokens,
      maxInputChars: config.maxInputChars,
    },
    totals: {
      runCount: records.length,
      todayActualCostUsd: roundCost(totals.todayCostUsd),
      monthActualCostUsd: roundCost(totals.monthCostUsd),
      allTimeActualCostUsd: roundCost(totals.allTimeCostUsd),
      allTimeEstimatedCostUsd: roundCost(estimatedAllTimeCostUsd),
      attemptedInputTokens,
      attemptedOutputTokens,
      actualInputTokens,
      actualOutputTokens,
    },
    byStatus,
    byModel,
    recentRuns,
  }
}

function resolveLlmBudgetConfigForSummary(env) {
  try {
    return resolveLlmBudgetConfig(env)
  } catch {
    const provider = String(env.LLM_PROVIDER || 'local').toLowerCase()
    return {
      provider,
      enabled: PAID_LLM_PROVIDERS.has(provider),
      modelId: resolveModelId(provider, env),
      region: provider === 'claude_cli'
        ? 'local_claude_cli'
        : (env.BEDROCK_REGION || env.AWS_REGION || env.AWS_DEFAULT_REGION || 'ap-northeast-1'),
      maxOutputTokens: Number(env.LLM_MAX_OUTPUT_TOKENS || 2200),
      maxInputChars: Number(env.LLM_MAX_INPUT_CHARS || 18000),
      dailyBudgetUsd: env.LLM_DAILY_BUDGET_USD ? Number(env.LLM_DAILY_BUDGET_USD) : null,
      monthlyBudgetUsd: env.LLM_MONTHLY_BUDGET_USD ? Number(env.LLM_MONTHLY_BUDGET_USD) : null,
      maxRequestUsd: env.LLM_MAX_REQUEST_USD ? Number(env.LLM_MAX_REQUEST_USD) : null,
      usageLedgerPath: env.LLM_USAGE_LEDGER_PATH || path.join(runtimeDir, 'llm-usage.jsonl'),
      pricing: {
        inputPerMillionUsd: Number(env.LLM_INPUT_PRICE_PER_1M_USD || DEFAULT_SONNET_PRICING.inputPerMillionUsd),
        outputPerMillionUsd: Number(env.LLM_OUTPUT_PRICE_PER_1M_USD || DEFAULT_SONNET_PRICING.outputPerMillionUsd),
      },
    }
  }
}

function incrementRollup(current = null, { estimatedCostUsd, actualCostUsd, inputTokens, outputTokens }) {
  return {
    count: (current?.count || 0) + 1,
    estimatedCostUsd: roundCost((current?.estimatedCostUsd || 0) + estimatedCostUsd),
    actualCostUsd: roundCost((current?.actualCostUsd || 0) + actualCostUsd),
    inputTokens: (current?.inputTokens || 0) + inputTokens,
    outputTokens: (current?.outputTokens || 0) + outputTokens,
  }
}

function publicUsageRecord(record) {
  return {
    id: record.id,
    requestId: record.requestId,
    planId: record.planId,
    companyId: record.companyId,
    diagnosisId: record.diagnosisId,
    roundId: record.roundId,
    templateId: record.templateId,
    createdAt: record.createdAt,
    provider: record.provider,
    modelId: record.modelId,
    status: record.status,
    requestKind: record.requestKind,
    inputTokens: Number(record.inputTokens || 0),
    outputTokens: Number(record.outputTokens || 0),
    estimatedCostUsd: roundCost(Number(record.estimatedCostUsd || 0)),
    actualCostUsd: roundCost(Number(record.actualCostUsd || 0)),
    currency: record.currency || 'USD',
    errorCode: record.metadata?.errorCode || null,
    fallback: Boolean(record.metadata?.fallback),
  }
}

export function estimateLlmRequestCost({ inputText = '', maxOutputTokens = 0, pricing = DEFAULT_SONNET_PRICING } = {}) {
  const inputTokens = estimateTokens(inputText)
  const outputTokens = Number(maxOutputTokens || 0)
  const estimatedCostUsd = estimateCostUsd({ inputTokens, outputTokens, pricing })
  return {
    inputTokens,
    outputTokens,
    estimatedCostUsd,
  }
}

export function estimateCostUsd({ inputTokens = 0, outputTokens = 0, pricing = DEFAULT_SONNET_PRICING } = {}) {
  return roundCost(
    (Number(inputTokens) / 1_000_000) * Number(pricing.inputPerMillionUsd || 0) +
    (Number(outputTokens) / 1_000_000) * Number(pricing.outputPerMillionUsd || 0),
  )
}

export function estimateTokens(text = '') {
  return Math.max(1, Math.ceil(String(text || '').length / 2.5))
}

function parseRequiredPositiveNumber(value, name) {
  if (value === undefined || value === null || value === '') {
    throw budgetError('LLM_BUDGET_CONFIG_REQUIRED', `${name} is required when paid LLM calls are enabled`, { name })
  }
  return parsePositiveNumber(value, name)
}

function resolveModelId(provider, env) {
  if (provider === 'claude_cli') {
    return env.CLAUDE_CLI_MODEL || env.ANTHROPIC_MODEL || env.LLM_MODEL_ID || DEFAULT_CLAUDE_CLI_MODEL_ID
  }
  return env.BEDROCK_MODEL_ID || env.LLM_MODEL_ID || DEFAULT_BEDROCK_MODEL_ID
}

function parsePositiveNumber(value, name) {
  const number = Number(value)
  if (!Number.isFinite(number) || number <= 0) {
    throw budgetError('LLM_BUDGET_CONFIG_INVALID', `${name} must be a positive number`, { name, value })
  }
  return number
}

function parsePositiveInteger(value, name) {
  const number = Number(value)
  if (!Number.isInteger(number) || number <= 0) {
    throw budgetError('LLM_BUDGET_CONFIG_INVALID', `${name} must be a positive integer`, { name, value })
  }
  return number
}

function budgetError(code, message, details = {}) {
  const error = new Error(message)
  error.code = code
  error.status = 429
  error.details = details
  return error
}

function resolveActualCost(record) {
  if (record.actualCostUsd !== undefined && record.actualCostUsd !== null) {
    return Number(record.actualCostUsd || 0)
  }
  return record.status === 'completed' || record.status === 'invalid_output'
    ? Number(record.estimatedCostUsd || 0)
    : 0
}

function toDayKey(date) {
  return new Date(date).toISOString().slice(0, 10)
}

function toMonthKey(date) {
  return new Date(date).toISOString().slice(0, 7)
}

function roundCost(value) {
  return Math.round(Number(value || 0) * 1_000_000) / 1_000_000
}
