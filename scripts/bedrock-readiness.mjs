#!/usr/bin/env node
import { spawnSync } from 'node:child_process'

const DEFAULT_MODEL_ID = 'apac.anthropic.claude-3-5-sonnet-20241022-v2:0'
const DEFAULT_SMOKE_MODEL_ID = 'apac.anthropic.claude-3-haiku-20240307-v1:0'

const args = new Set(process.argv.slice(2))
const region = process.env.BEDROCK_REGION || process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'ap-northeast-1'
const modelId = process.env.BEDROCK_MODEL_ID || process.env.LLM_MODEL_ID || DEFAULT_MODEL_ID
const smokeModelId = process.env.BEDROCK_SMOKE_MODEL_ID || DEFAULT_SMOKE_MODEL_ID
const failures = []

if (args.has('--help') || args.has('-h')) {
  printHelp()
  process.exit(0)
}

if (args.has('--submit-use-case')) {
  submitUseCase()
}

const identity = runJson(['sts', 'get-caller-identity'], { region: false })
if (identity.ok) {
  console.log(`AWS account: ${identity.json.Account}`)
  console.log(`AWS principal: ${identity.json.Arn}`)
} else {
  fail('aws_identity', identity.error)
}

console.log(`AWS region: ${region}`)
console.log(`Plan-generation model: ${modelId}`)
console.log(`Smoke-test model: ${smokeModelId}`)

checkUseCase()
const baseModelIds = resolveBaseModels(modelId)

if (args.has('--create-agreement')) {
  for (const baseModelId of baseModelIds) {
    createAgreement(baseModelId)
  }
}

for (const baseModelId of baseModelIds) {
  checkModelAvailability(baseModelId)
}

checkRelevantQuotas([...baseModelIds, smokeModelId])

if (args.has('--smoke')) {
  runSmoke()
}

if (failures.length > 0) {
  console.error('\nBedrock readiness: FAIL')
  for (const item of failures) {
    console.error(`- ${item.step}: ${item.message}`)
  }
  process.exit(1)
}

console.log('\nBedrock readiness: PASS')

function printHelp() {
  console.log(`Usage: node scripts/bedrock-readiness.mjs [options]

Read-only by default. Uses AWS CLI credentials from the current shell.

Options:
  --submit-use-case    Submit the Anthropic first-time-use form from BEDROCK_USE_CASE_* env vars.
  --create-agreement  Create foundation model agreements for the configured model's base models.
  --smoke             Run one minimal Bedrock Converse call. This can incur a tiny charge.
  --help              Show this help.

Common env:
  AWS_REGION=ap-northeast-1
  BEDROCK_MODEL_ID=${DEFAULT_MODEL_ID}
  BEDROCK_SMOKE_MODEL_ID=${DEFAULT_SMOKE_MODEL_ID}

Use-case env for --submit-use-case:
  BEDROCK_USE_CASE_COMPANY_NAME
  BEDROCK_USE_CASE_COMPANY_WEBSITE
  BEDROCK_USE_CASE_INTENDED_USERS=0|1|2
  BEDROCK_USE_CASE_INDUSTRY_OPTION
  BEDROCK_USE_CASE_OTHER_INDUSTRY_OPTION
  BEDROCK_USE_CASES
`)
}

function submitUseCase() {
  const form = {
    companyName: requiredEnv('BEDROCK_USE_CASE_COMPANY_NAME'),
    companyWebsite: requiredEnv('BEDROCK_USE_CASE_COMPANY_WEBSITE'),
    intendedUsers: requiredEnv('BEDROCK_USE_CASE_INTENDED_USERS'),
    industryOption: requiredEnv('BEDROCK_USE_CASE_INDUSTRY_OPTION'),
    otherIndustryOption: requiredEnv('BEDROCK_USE_CASE_OTHER_INDUSTRY_OPTION'),
    useCases: requiredEnv('BEDROCK_USE_CASES'),
  }
  const formData = Buffer.from(JSON.stringify(form), 'utf8').toString('base64')
  const result = runJson(['bedrock', 'put-use-case-for-model-access', '--form-data', formData])
  if (result.ok) {
    console.log(`Submitted Anthropic FTU use case for ${form.companyName}.`)
  } else {
    fail('submit_use_case', result.error)
  }
}

function checkUseCase() {
  const result = runJson(['bedrock', 'get-use-case-for-model-access'])
  if (!result.ok) {
    fail('anthropic_use_case', result.error)
    return
  }
  const parsed = parseUseCaseForm(result.json.formData)
  if (parsed) {
    console.log(`Anthropic FTU use case: submitted for ${parsed.companyName || 'unknown company'}`)
  } else {
    console.log('Anthropic FTU use case: submitted')
  }
}

function resolveBaseModels(configuredModelId) {
  const profile = runJson([
    'bedrock',
    'get-inference-profile',
    '--inference-profile-identifier',
    configuredModelId,
  ])

  if (!profile.ok) {
    return [stripFoundationModelId(configuredModelId)]
  }

  const models = Array.isArray(profile.json.models) ? profile.json.models : []
  const baseModelIds = [...new Set(models
    .map((item) => stripFoundationModelId(item.modelArn || item.modelId || ''))
    .filter(Boolean))]

  console.log(`Inference profile: ${profile.json.inferenceProfileName || configuredModelId}`)
  console.log(`Profile base models: ${baseModelIds.join(', ') || 'none'}`)
  return baseModelIds.length > 0 ? baseModelIds : [configuredModelId]
}

function createAgreement(baseModelId) {
  const offer = runJson([
    'bedrock',
    'list-foundation-model-agreement-offers',
    '--model-id',
    baseModelId,
  ])
  const offerToken = offer.json?.offers?.[0]?.offerToken
  if (!offer.ok || !offerToken) {
    fail(`agreement_offer:${baseModelId}`, offer.error || 'No foundation model agreement offer found.')
    return
  }
  const result = runJson([
    'bedrock',
    'create-foundation-model-agreement',
    '--model-id',
    baseModelId,
    '--offer-token',
    offerToken,
  ])
  if (result.ok) {
    console.log(`Foundation model agreement requested: ${baseModelId}`)
  } else {
    fail(`create_agreement:${baseModelId}`, result.error)
  }
}

function checkModelAvailability(baseModelId) {
  const result = runJson([
    'bedrock',
    'get-foundation-model-availability',
    '--model-id',
    baseModelId,
  ])
  if (!result.ok) {
    fail(`model_availability:${baseModelId}`, result.error)
    return
  }
  const availability = result.json
  const agreement = availability.agreementAvailability?.status || 'UNKNOWN'
  console.log([
    `Availability ${baseModelId}:`,
    `agreement=${agreement}`,
    `authorization=${availability.authorizationStatus || 'UNKNOWN'}`,
    `entitlement=${availability.entitlementAvailability || 'UNKNOWN'}`,
    `region=${availability.regionAvailability || 'UNKNOWN'}`,
  ].join(' '))
  if (!['AVAILABLE', 'NOT_AVAILABLE'].includes(agreement)) {
    fail(`model_agreement:${baseModelId}`, `Agreement is ${agreement}; wait and rerun preflight.`)
  }
}

function checkRelevantQuotas(modelIds) {
  const keywords = [...new Set(modelIds.map(modelKeyword).filter(Boolean))]
  if (keywords.length === 0) return

  const result = runJson([
    'service-quotas',
    'list-service-quotas',
    '--service-code',
    'bedrock',
  ])
  if (!result.ok) {
    fail('service_quotas', result.error)
    return
  }

  const quotas = Array.isArray(result.json.Quotas) ? result.json.Quotas : []
  for (const keyword of keywords) {
    const relevant = quotas.filter((quota) => {
      const name = quota.QuotaName || ''
      return name.includes(keyword) &&
        /tokens per day|tokens per minute|requests per minute/i.test(name)
    })
    if (relevant.length === 0) {
      console.log(`Quota ${keyword}: no directly matching invocation quota found`)
      continue
    }
    for (const quota of relevant) {
      const value = Number(quota.Value || 0)
      console.log(`Quota ${quota.QuotaName}: ${value}`)
      if (value <= 0) {
        fail(`quota:${quota.QuotaCode}`, `${quota.QuotaName} is ${value}. Bedrock runtime calls will throttle until AWS raises/unlocks this quota.`)
      }
    }
  }
}

function runSmoke() {
  const result = runJson([
    'bedrock-runtime',
    'converse',
    '--model-id',
    smokeModelId,
    '--messages',
    JSON.stringify([{ role: 'user', content: [{ text: 'Return exactly: ok' }] }]),
    '--inference-config',
    JSON.stringify({ maxTokens: 10, temperature: 0 }),
  ], {
    env: { AWS_MAX_ATTEMPTS: '1' },
  })

  if (!result.ok) {
    fail('bedrock_smoke', result.error)
    return
  }
  const usage = result.json.usage || {}
  const text = result.json.output?.message?.content?.map((item) => item.text).filter(Boolean).join(' ') || ''
  console.log(`Smoke response: ${text.trim()}`)
  console.log(`Smoke usage: input=${usage.inputTokens || 0} output=${usage.outputTokens || 0}`)
}

function runJson(awsArgs, options = {}) {
  const finalArgs = [...awsArgs]
  if (options.region !== false && !finalArgs.includes('--region')) {
    finalArgs.push('--region', region)
  }
  if (!finalArgs.includes('--output')) {
    finalArgs.push('--output', 'json')
  }
  const result = spawnSync('aws', finalArgs, {
    encoding: 'utf8',
    env: { ...process.env, ...(options.env || {}) },
  })
  const stdout = result.stdout?.trim() || ''
  const stderr = result.stderr?.trim() || ''
  if (result.status !== 0) {
    return { ok: false, error: stderr || stdout || `aws ${finalArgs.join(' ')} failed` }
  }
  if (!stdout) return { ok: true, json: {} }
  try {
    return { ok: true, json: JSON.parse(stdout) }
  } catch {
    return { ok: true, json: { raw: stdout } }
  }
}

function parseUseCaseForm(formData) {
  if (!formData) return null
  const first = decodeBase64(formData)
  const candidates = [first, decodeBase64(first)]
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate)
    } catch {
      // Try the next representation. AWS CLI blob encoding differs by input mode.
    }
  }
  return null
}

function decodeBase64(value) {
  try {
    return Buffer.from(String(value), 'base64').toString('utf8')
  } catch {
    return ''
  }
}

function stripFoundationModelId(value) {
  const match = String(value || '').match(/foundation-model\/(.+)$/)
  return match?.[1] || String(value || '')
}

function modelKeyword(value) {
  const model = String(value || '')
  if (model.includes('claude-3-haiku')) return 'Anthropic Claude 3 Haiku'
  if (model.includes('claude-3-5-sonnet')) return 'Anthropic Claude 3.5 Sonnet'
  if (model.includes('claude-sonnet-4-5')) return 'Anthropic Claude Sonnet 4.5'
  if (model.includes('claude-haiku-4-5')) return 'Anthropic Claude Haiku 4.5'
  if (model.includes('nova-micro')) return 'Amazon Nova Micro'
  return null
}

function requiredEnv(name) {
  const value = process.env[name]
  if (!value) {
    fail('config', `${name} is required.`)
    process.exit(1)
  }
  return value
}

function fail(step, message) {
  failures.push({ step, message: String(message || 'failed') })
}
