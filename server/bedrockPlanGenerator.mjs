import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime'
import {
  buildPlanConfirmationFlags,
  buildPlanSectionsLocalMock,
  buildPlanSourceReferences,
  buildRequiredDocumentChecklist,
  selectPlanTemplate,
} from './planTemplates.mjs'
import {
  assertLlmBudgetAllowed,
  estimateCostUsd,
  recordLlmUsage,
  resolveLlmBudgetConfig,
} from './llmCostGuard.mjs'
import { DISCLAIMER } from './seedData.mjs'
import { nowIso } from './utils.mjs'

export function createBedrockPlanGenerator(options = {}) {
  const env = options.env || process.env
  const config = resolveLlmBudgetConfig(env)
  if (!config.enabled) {
    throw Object.assign(new Error('LLM_PROVIDER=bedrock is required to create BedrockPlanGenerator'), {
      code: 'LLM_DISABLED',
      status: 400,
    })
  }
  const invokeBedrock = options.invokeBedrock || invokeBedrockConverse

  return {
    provider: 'bedrock',
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
      const prompt = buildPlanPrompt({ profile, round, targetChars, config })
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
            errorMessage: error.message,
            fallback: true,
          },
        })
        throw error
      }
      const startedAt = nowIso()
      let response
      try {
        response = await invokeBedrock({ config, prompt })
      } catch (error) {
        await recordPlanUsage({
          config,
          status: 'provider_error',
          estimate: budget.estimate,
          actualCostUsd: 0,
          createdAt: startedAt,
          metadata: {
            ...usageMetadata,
            errorCode: error.code || error.name || 'BEDROCK_PROVIDER_ERROR',
            errorMessage: error.message,
            fallback: true,
          },
        })
        throw error
      }
      const usage = normalizeUsage(response?.usage, budget.estimate)
      const cost = estimateCostUsd({
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        pricing: config.pricing,
      })
      let responseText
      let sections
      try {
        responseText = extractBedrockText(response)
        sections = normalizePlanSectionsFromJson(responseText, { profile, round, targetChars })
      } catch (error) {
        await recordPlanUsage({
          config,
          status: 'invalid_output',
          estimate: budget.estimate,
          usage,
          actualCostUsd: cost,
          createdAt: startedAt,
          metadata: {
            ...usageMetadata,
            errorCode: error.code || 'BEDROCK_OUTPUT_INVALID',
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
        actualCostUsd: cost,
        createdAt: startedAt,
        metadata: usageMetadata,
      })
      attachGeneration(sections, {
        ...bedrockProvenance(config),
        budget: publicBudgetConfig(config),
        usage: {
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          estimatedCostUsd: budget.estimate.estimatedCostUsd,
          actualCostUsd: cost,
        },
      })
      return sections
    },
    provenance: () => ({
      ...bedrockProvenance(config),
      budget: publicBudgetConfig(config),
    }),
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
    provider: 'bedrock',
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

export async function invokeBedrockConverse({ config, prompt }) {
  const client = new BedrockRuntimeClient({ region: config.region })
  const command = new ConverseCommand({
    modelId: config.modelId,
    system: [{ text: prompt.system }],
    messages: [
      {
        role: 'user',
        content: [{ text: prompt.user }],
      },
    ],
    inferenceConfig: {
      maxTokens: config.maxOutputTokens,
      temperature: 0.2,
      topP: 0.9,
    },
  })
  return client.send(command)
}

export function buildPlanPrompt({ profile = {}, round = {}, targetChars = 4200, config = {} } = {}) {
  const template = selectPlanTemplate(round)
  const sourceReferences = buildPlanSourceReferences(profile, round)
  const requiredDocuments = buildRequiredDocumentChecklist(round)
  const confirmationFlags = buildPlanConfirmationFlags(profile, round, template)
  const safeProfile = {
    name: profile.name,
    prefecture: profile.prefecture,
    city: profile.city,
    businessSummary: profile.businessSummary,
    keywords: profile.keywords,
    unknowns: profile.unknowns,
    citations: profile.citations,
  }
  const safeRound = {
    roundId: round.roundId,
    programName: round.program?.name,
    issuer: round.program?.issuer,
    overview: round.program?.overview,
    roundLabel: round.roundLabel,
    maxLimit: round.maxLimit,
    subsidyRate: round.subsidyRate,
    acceptEnd: round.acceptEnd,
    keywords: round.keywords,
    requirements: round.requirements,
    requiredDocuments: round.requiredDocuments,
    sourceUrl: round.program?.sourceUrl,
    lastSeenAt: round.lastSeenAt,
  }

  return {
    system: [
      'あなたは補助金ポケットの事業計画書下書き支援エンジンです。',
      '行政書士・専門家の最終確認前提の applicant-owned draft だけを作成します。',
      '採択可能性、法的判断、代理提出、提出代行、取引条件や手数料体系は書かないでください。',
      '根拠がない数値は作らず、要確認として明示してください。',
      '必ず JSON だけを返してください。Markdown や説明文は不要です。',
    ].join('\n'),
    user: JSON.stringify({
      task: 'Create structured Japanese business-plan draft sections for applicant review.',
      outputSchema: {
        sections: [
          {
            chapterNo: 'number from 1 to 5',
            heading: 'short Japanese heading',
            body: 'Japanese draft body. Keep each section concise and source-bounded.',
            status: 'ai_draft or needs_confirmation',
            needsConfirmation: 'boolean',
            confirmationFlags: ['items the applicant must verify'],
            requiredDocumentRefs: ['required document labels related to the section'],
          },
        ],
      },
      constraints: {
        targetChars,
        maxOutputTokens: config.maxOutputTokens,
        requiredSectionCount: 5,
        disclaimer: DISCLAIMER,
        noDelegatedFiling: true,
        noAdoptionProbabilityClaim: true,
      },
      companyProfile: safeProfile,
      subsidyRound: safeRound,
      selectedTemplate: template,
      sourceReferences,
      requiredDocuments,
      confirmationFlags,
    }, null, 2),
  }
}

export function normalizePlanSectionsFromJson(text, { profile, round, targetChars, provider = 'Bedrock' }) {
  const parsed = parseJsonObject(text)
  if (!Array.isArray(parsed.sections) || parsed.sections.length < 3) {
    throw Object.assign(new Error(`${provider} output did not include structured sections`), {
      code: `${provider.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}_OUTPUT_INVALID`,
      status: 502,
    })
  }
  const fallback = buildPlanSectionsLocalMock(profile, round, { targetChars })
  const template = selectPlanTemplate(round)
  const sourceReferences = buildPlanSourceReferences(profile, round)
  const requiredDocuments = buildRequiredDocumentChecklist(round)
  const confirmationFlags = buildPlanConfirmationFlags(profile, round, template)

  return fallback.map((fallbackSection, index) => {
    const generated = parsed.sections.find((section) => Number(section.chapterNo) === fallbackSection.chapterNo) || parsed.sections[index] || {}
    const body = String(generated.body || fallbackSection.body || '').trim()
    if (!body) {
      throw Object.assign(new Error(`${provider} output section ${fallbackSection.chapterNo} is empty`), {
        code: `${provider.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}_OUTPUT_INVALID`,
        status: 502,
      })
    }
    const needsConfirmation = typeof generated.needsConfirmation === 'boolean'
      ? generated.needsConfirmation
      : fallbackSection.needsConfirmation
    const status = ['ai_draft', 'needs_confirmation'].includes(generated.status)
      ? generated.status
      : (needsConfirmation ? 'needs_confirmation' : fallbackSection.status)
    return {
      ...fallbackSection,
      heading: String(generated.heading || fallbackSection.heading).trim(),
      body,
      status,
      needsConfirmation,
      confirmationFlags: nonEmptyStrings(generated.confirmationFlags).length
        ? nonEmptyStrings(generated.confirmationFlags).slice(0, 8)
        : (fallbackSection.confirmationFlags || confirmationFlags).slice(0, 8),
      requiredDocumentRefs: nonEmptyStrings(generated.requiredDocumentRefs).length
        ? nonEmptyStrings(generated.requiredDocumentRefs).slice(0, 8)
        : (fallbackSection.requiredDocumentRefs || requiredDocuments.map((item) => item.label)).slice(0, 8),
      sources: fallbackSection.sources?.length ? fallbackSection.sources : sourceReferences,
      templateId: template.id,
      templateName: template.name,
      templateCategory: template.category,
      templateVersion: template.version,
      revision: 1,
      charCount: body.length,
    }
  })
}

function parseJsonObject(text) {
  const raw = String(text || '').trim()
  const candidates = [
    raw,
    raw.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1],
    raw.match(/(\{[\s\S]*\})/)?.[1],
  ].filter(Boolean)

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate)
    } catch {
      // Try the next candidate.
    }
  }
  throw Object.assign(new Error('Bedrock output was not valid JSON'), {
    code: 'BEDROCK_OUTPUT_INVALID',
    status: 502,
  })
}

function extractBedrockText(response) {
  const blocks = response?.output?.message?.content || []
  const text = blocks.map((block) => block.text || '').join('\n').trim()
  if (!text) {
    throw Object.assign(new Error('Bedrock response did not include text'), {
      code: 'BEDROCK_EMPTY_RESPONSE',
      status: 502,
    })
  }
  return text
}

function normalizeUsage(usage, estimate) {
  return {
    inputTokens: Number(usage?.inputTokens || estimate.inputTokens || 0),
    outputTokens: Number(usage?.outputTokens || estimate.outputTokens || 0),
  }
}

export function attachGeneration(sections, generation) {
  Object.defineProperty(sections, 'generation', {
    value: generation,
    enumerable: false,
    configurable: true,
  })
  return sections
}

function bedrockProvenance(config) {
  return {
    provider: 'bedrock',
    mode: 'structured_json_plan',
    model: config.modelId,
    llm: true,
    adapter: 'PlanGenerator.bedrock',
    phase: 'phase2_cost_guard',
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

function nonEmptyStrings(values = []) {
  return Array.isArray(values)
    ? values.map((value) => String(value || '').trim()).filter(Boolean)
    : []
}
