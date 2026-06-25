import { spawn } from 'node:child_process'
import { buildPlanPrompt, normalizePlanSectionsFromJson, attachGeneration } from './bedrockPlanGenerator.mjs'
import {
  assertLlmBudgetAllowed,
  estimateCostUsd,
  recordLlmUsage,
  resolveLlmBudgetConfig,
} from './llmCostGuard.mjs'
import {
  buildPlanConfirmationFlags,
  buildPlanSourceReferences,
  buildRequiredDocumentChecklist,
  selectPlanTemplate,
} from './planTemplates.mjs'
import { DISCLAIMER } from './seedData.mjs'
import { nowIso } from './utils.mjs'

const DEFAULT_TIMEOUT_MS = 120000
const DEFAULT_MAX_BUFFER_BYTES = 5 * 1024 * 1024
const SAFE_PROVIDER_ERROR_MESSAGE = 'Claude CLI generation failed'

export function createClaudeCliPlanGenerator(options = {}) {
  const env = options.env || process.env
  const config = resolveLlmBudgetConfig(env)
  if (!config.enabled || config.provider !== 'claude_cli') {
    throw Object.assign(new Error('LLM_PROVIDER=claude_cli is required to create ClaudeCliPlanGenerator'), {
      code: 'LLM_DISABLED',
      status: 400,
    })
  }
  const invokeClaude = options.invokeClaude || invokeClaudeCli

  return {
    provider: 'claude_cli',
    async createSections({ profile, round, targetChars = 4200, planId = null, companyId = null, diagnosisId = null }) {
      const requestId = `llm_plan_${planId || Date.now()}`
      const template = selectPlanTemplate(round)
      const usageMetadata = {
        requestId,
        planId,
        companyId,
        diagnosisId,
        roundId: round.roundId,
        templateId: template.id,
      }
      const prompt = buildClaudeCliPlanPrompt({ profile, round, targetChars, config, env })
      let budget
      try {
        budget = await assertLlmBudgetAllowed({
          config,
          inputText: `${prompt.system}\n${prompt.user}`,
          maxOutputTokens: config.maxOutputTokens,
        })
      } catch (error) {
        await recordPlanUsage({
          config,
          status: 'budget_denied',
          estimate: error.details?.estimate,
          actualCostUsd: 0,
          metadata: {
            ...usageMetadata,
            errorCode: error.code || 'LLM_BUDGET_DENIED',
            errorMessage: safeProviderErrorMessage(error),
            fallback: true,
          },
        })
        throw error
      }

      const startedAt = nowIso()
      let response
      try {
        response = await invokeClaude({ config, prompt, env })
      } catch (error) {
        const errorResponse = error.details?.response
        const usage = errorResponse
          ? normalizeClaudeCliUsage(errorResponse.usage, budget.estimate)
          : null
        const actualCostUsd = Number.isFinite(Number(errorResponse?.total_cost_usd))
          ? Number(errorResponse.total_cost_usd)
          : 0
        const status = error.code === 'CLAUDE_CLI_BUDGET_EXCEEDED' ? 'budget_exceeded' : 'provider_error'
        await recordPlanUsage({
          config,
          status,
          estimate: budget.estimate,
          usage,
          actualCostUsd,
          createdAt: startedAt,
          metadata: {
            ...usageMetadata,
            errorCode: error.code || error.name || 'CLAUDE_CLI_PROVIDER_ERROR',
            errorMessage: safeProviderErrorMessage(error),
            responseSubtype: errorResponse?.subtype || null,
            terminalReason: errorResponse?.terminal_reason || null,
            fallback: true,
          },
        })
        throw error
      }

      const usage = normalizeClaudeCliUsage(response?.usage, budget.estimate)
      const actualCostUsd = Number.isFinite(Number(response?.total_cost_usd))
        ? Number(response.total_cost_usd)
        : estimateCostUsd({ inputTokens: usage.inputTokens, outputTokens: usage.outputTokens, pricing: config.pricing })
      let sections
      try {
        sections = normalizePlanSectionsFromJson(response?.result, { profile, round, targetChars, provider: 'Claude CLI' })
      } catch (error) {
        await recordPlanUsage({
          config,
          status: 'invalid_output',
          estimate: budget.estimate,
          usage,
          actualCostUsd,
          createdAt: startedAt,
          metadata: {
            ...usageMetadata,
            errorCode: error.code || 'CLAUDE_CLI_OUTPUT_INVALID',
            errorMessage: error.message,
            fallback: true,
          },
        })
        throw error
      }

      await recordPlanUsage({
        config,
        status: 'completed',
        estimate: budget.estimate,
        usage,
        actualCostUsd,
        createdAt: startedAt,
        metadata: {
          ...usageMetadata,
          sessionId: response?.session_id || null,
          stopReason: response?.stop_reason || null,
          terminalReason: response?.terminal_reason || null,
        },
      })
      attachGeneration(sections, {
        ...claudeCliProvenance(config),
        budget: publicBudgetConfig(config),
        usage: {
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          estimatedCostUsd: budget.estimate.estimatedCostUsd,
          actualCostUsd,
        },
      })
      return sections
    },
    provenance: () => ({
      ...claudeCliProvenance(config),
      budget: publicBudgetConfig(config),
    }),
  }
}

export async function invokeClaudeCli({ config, prompt, env = process.env }) {
  const command = env.CLAUDE_CLI_COMMAND || 'claude'
  const timeout = parsePositiveInteger(env.CLAUDE_CLI_TIMEOUT_MS || DEFAULT_TIMEOUT_MS, 'CLAUDE_CLI_TIMEOUT_MS')
  const args = [
    '-p',
    '--input-format',
    'text',
    '--output-format',
    'json',
    '--model',
    config.modelId,
    '--tools',
    '',
    '--no-session-persistence',
    '--safe-mode',
    '--prompt-suggestions',
    'false',
    '--system-prompt',
    prompt.system,
    '--max-budget-usd',
    String(config.maxRequestUsd),
  ]
  if (env.CLAUDE_CLI_JSON_SCHEMA === '1') {
    args.push('--json-schema', JSON.stringify(planJsonSchema()))
  }
  const childEnv = sanitizeClaudeCliEnv(env)
  const { stdout } = await runClaudeCliProcess(command, args, {
    env: childEnv,
    timeout,
    maxBuffer: DEFAULT_MAX_BUFFER_BYTES,
    input: prompt.user,
  })
  const result = parseClaudeCliJson(stdout)
  if (result.is_error || result.subtype === 'error') {
    const code = result.subtype === 'error_max_budget_usd'
      ? 'CLAUDE_CLI_BUDGET_EXCEEDED'
      : (result.api_error_status || 'CLAUDE_CLI_PROVIDER_ERROR')
    throw Object.assign(new Error(result.result || result.errors?.join('; ') || result.error || 'Claude CLI returned an error'), {
      code,
      status: 502,
      details: { subtype: result.subtype, terminalReason: result.terminal_reason, response: result },
    })
  }
  return result
}

function safeProviderErrorMessage(error) {
  if (!error) return SAFE_PROVIDER_ERROR_MESSAGE
  if (error.code === 'CLAUDE_CLI_BUDGET_EXCEEDED') return 'Claude CLI request exceeded the configured budget'
  if (error.code === 'CLAUDE_CLI_EMPTY_RESPONSE') return 'Claude CLI returned empty output'
  if (error.code === 'CLAUDE_CLI_OUTPUT_INVALID') return 'Claude CLI output was not valid JSON'
  if (String(error.code || '').startsWith('CLAUDE_CLI_')) return SAFE_PROVIDER_ERROR_MESSAGE
  if (String(error.code || '').startsWith('LLM_')) return error.message || 'LLM budget guard rejected the request'
  return 'Plan generation failed'
}

function runClaudeCliProcess(command, args, { env, timeout, maxBuffer, input }) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    let settled = false
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      child.kill('SIGTERM')
    }, timeout)

    const failOnce = (error) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      reject(error)
    }

    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', (chunk) => {
      stdout += chunk
      if (Buffer.byteLength(stdout, 'utf8') > maxBuffer) {
        child.kill('SIGTERM')
        failOnce(Object.assign(new Error('Claude CLI output exceeded max buffer'), {
          code: 'CLAUDE_CLI_MAX_BUFFER',
          status: 502,
          stdout,
          stderr,
        }))
      }
    })
    child.stderr.on('data', (chunk) => {
      stderr += chunk
      if (Buffer.byteLength(stderr, 'utf8') > maxBuffer) {
        stderr = stderr.slice(-maxBuffer)
      }
    })
    child.on('error', (error) => {
      failOnce(Object.assign(new Error(SAFE_PROVIDER_ERROR_MESSAGE), {
        code: 'CLAUDE_CLI_PROCESS_FAILED',
        status: 502,
        cause: error,
        stdout,
        stderr: sanitizeProcessOutput(stderr),
      }))
    })
    child.on('close', (exitCode, signal) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      if (exitCode === 0) {
        resolve({ stdout, stderr })
        return
      }
      if (stdout.trim()) {
        resolve({ stdout, stderr })
        return
      }
      reject(Object.assign(new Error(timedOut ? 'Claude CLI timed out' : SAFE_PROVIDER_ERROR_MESSAGE), {
        code: timedOut ? 'CLAUDE_CLI_TIMEOUT' : 'CLAUDE_CLI_PROCESS_FAILED',
        status: 502,
        exitCode,
        signal,
        stdout,
        stderr: sanitizeProcessOutput(stderr),
      }))
    })
    child.stdin.end(input)
  })
}

function sanitizeProcessOutput(value) {
  const text = String(value || '').trim()
  if (!text) return ''
  return text
    .replace(/Command failed:[\s\S]*/i, SAFE_PROVIDER_ERROR_MESSAGE)
    .slice(0, 1000)
}

function buildClaudeCliPlanPrompt({ profile = {}, round = {}, targetChars = 4200, config = {}, env = process.env } = {}) {
  if (String(env.CLAUDE_CLI_PROMPT_MODE || 'compact').toLowerCase() === 'full') {
    return buildPlanPrompt({ profile, round, targetChars, config })
  }

  const template = selectPlanTemplate(round)
  const sourceReferences = buildPlanSourceReferences(profile, round).slice(0, 4)
  const requiredDocuments = buildRequiredDocumentChecklist(round).slice(0, 6)
  const confirmationFlags = buildPlanConfirmationFlags(profile, round, template).slice(0, 8)
  const compactTargetChars = Math.min(
    positiveNumberOr(targetChars, 1600),
    positiveNumberOr(env.CLAUDE_CLI_TARGET_CHARS, 1600),
    1800,
  )
  const requirements = (round.requirements || [])
    .slice(0, 6)
    .map((requirement) => ({
      kind: requirement.kind,
      result: requirement.result,
      label: requirement.label,
      description: requirement.description,
    }))

  return {
    system: [
      '補助金ポケットの申請者向け下書き支援エンジンとして回答してください。',
      '出力はJSONのみ。Markdown、説明文、コードフェンスは禁止です。',
      '5章構成で、各bodyは短く、根拠がない数値は必ず要確認にしてください。',
      '採択可能性、法的判断、代理提出、提出代行、手数料体系は書かないでください。',
    ].join('\n'),
    user: JSON.stringify({
      task: 'Create compact Japanese business-plan draft sections for applicant review.',
      output: 'Return exactly {"sections":[{chapterNo,heading,body,status,needsConfirmation,confirmationFlags,requiredDocumentRefs} x5]}.',
      constraints: {
        totalBodyCharsMax: compactTargetChars,
        bodyCharsPerSectionMax: 220,
        statusValues: ['ai_draft', 'needs_confirmation'],
        disclaimer: DISCLAIMER,
        noDelegatedFiling: true,
        noAdoptionProbabilityClaim: true,
      },
      company: {
        name: profile.name,
        prefecture: profile.prefecture,
        city: profile.city,
        businessSummary: profile.businessSummary,
        keywords: (profile.keywords || []).slice(0, 8),
        unknowns: (profile.unknowns || []).slice(0, 8),
        citations: (profile.citations || []).slice(0, 3),
      },
      subsidy: {
        roundId: round.roundId,
        programName: round.program?.name,
        roundLabel: round.roundLabel,
        issuer: round.program?.issuer,
        maxLimit: round.maxLimit,
        subsidyRate: round.subsidyRate,
        acceptEnd: round.acceptEnd,
        keywords: (round.keywords || []).slice(0, 8),
        requirements,
        sourceReferences,
      },
      template: {
        id: template.id,
        name: template.name,
        focus: template.focus,
        investmentLabel: template.investmentLabel,
        outcomeLabel: template.outcomeLabel,
      },
      requiredDocuments: requiredDocuments.map((document) => document.label),
      confirmationFlags,
    }),
  }
}

function positiveNumberOr(value, fallback) {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : fallback
}

function sanitizeClaudeCliEnv(env) {
  const childEnv = { ...env }
  if (childEnv.CLAUDE_CLI_ALLOW_API_KEY !== '1') {
    delete childEnv.ANTHROPIC_API_KEY
  }
  return {
    ...childEnv,
    PATH: childEnv.PATH || process.env.PATH,
    CLAUDE_CODE_SAFE_MODE: childEnv.CLAUDE_CODE_SAFE_MODE || '1',
  }
}

function parseClaudeCliJson(stdout) {
  const raw = String(stdout || '').trim()
  if (!raw) {
    throw Object.assign(new Error('Claude CLI returned empty output'), {
      code: 'CLAUDE_CLI_EMPTY_RESPONSE',
      status: 502,
    })
  }
  try {
    return JSON.parse(raw)
  } catch (error) {
    throw Object.assign(new Error('Claude CLI output was not valid JSON'), {
      code: 'CLAUDE_CLI_OUTPUT_INVALID',
      status: 502,
      details: { parseError: error.message },
    })
  }
}

function normalizeClaudeCliUsage(usage = {}, estimate = {}) {
  const inputTokens = Number(usage.input_tokens || usage.inputTokens || 0) +
    Number(usage.cache_creation_input_tokens || 0) +
    Number(usage.cache_read_input_tokens || 0)
  return {
    inputTokens: inputTokens || Number(estimate.inputTokens || 0),
    outputTokens: Number(usage.output_tokens || usage.outputTokens || estimate.outputTokens || 0),
  }
}

async function recordPlanUsage({
  config,
  status,
  estimate = {},
  usage = null,
  actualCostUsd = 0,
  createdAt = nowIso(),
  metadata = {},
}) {
  return recordLlmUsage({
    requestId: metadata.requestId,
    planId: metadata.planId,
    companyId: metadata.companyId,
    diagnosisId: metadata.diagnosisId,
    roundId: metadata.roundId,
    templateId: metadata.templateId,
    createdAt,
    provider: 'claude_cli',
    modelId: config.modelId,
    status,
    inputTokens: Number(usage?.inputTokens || estimate?.inputTokens || 0),
    outputTokens: Number(usage?.outputTokens || estimate?.outputTokens || 0),
    estimatedCostUsd: Number(estimate?.estimatedCostUsd || 0),
    actualCostUsd,
    requestKind: 'plan_generation',
    metadata,
  }, config.usageLedgerPath)
}

function claudeCliProvenance(config) {
  return {
    provider: 'claude_cli',
    mode: 'structured_json_plan',
    model: config.modelId,
    llm: true,
    adapter: 'PlanGenerator.claudeCli',
    phase: 'phase2_local_subscription_llm',
    productionReady: false,
  }
}

function publicBudgetConfig(config) {
  return {
    region: config.region,
    dailyBudgetUsd: config.dailyBudgetUsd,
    monthlyBudgetUsd: config.monthlyBudgetUsd,
    maxRequestUsd: config.maxRequestUsd,
    maxOutputTokens: config.maxOutputTokens,
  }
}

function planJsonSchema() {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['sections'],
    properties: {
      sections: {
        type: 'array',
        minItems: 5,
        maxItems: 5,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['chapterNo', 'heading', 'body', 'status', 'needsConfirmation', 'confirmationFlags', 'requiredDocumentRefs'],
          properties: {
            chapterNo: { type: 'number' },
            heading: { type: 'string' },
            body: { type: 'string' },
            status: { type: 'string', enum: ['ai_draft', 'needs_confirmation'] },
            needsConfirmation: { type: 'boolean' },
            confirmationFlags: { type: 'array', items: { type: 'string' } },
            requiredDocumentRefs: { type: 'array', items: { type: 'string' } },
          },
        },
      },
    },
  }
}

function parsePositiveInteger(value, name) {
  const number = Number(value)
  if (!Number.isInteger(number) || number <= 0) {
    throw Object.assign(new Error(`${name} must be a positive integer`), {
      code: 'LLM_BUDGET_CONFIG_INVALID',
      status: 400,
      details: { name, value },
    })
  }
  return number
}
