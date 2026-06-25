import { promises as fs } from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { pathToFileURL } from 'node:url'
import { rootDir, runtimeDir, writeJson } from '../server/utils.mjs'
import {
  buildSeedDraftStore,
  DEFAULT_OUTPUT_PATH as DEFAULT_DRAFT_STORE_PATH,
  readSeedDraftStore,
} from './import-seed-draft-pack.mjs'

export const PUBLISHED_SEED_SCHEMA = 'hojokin-pocket.published-seed-rounds.v1'
export const DEFAULT_PUBLISHED_SEED_PATH = path.join(runtimeDir, 'published-seed-rounds.json')
export const DEFAULT_SKIP_ROUND_KEYS = new Set([
  'jizokuka_normal_20',
  'digital_ai_2026_normal_3',
])

const KEYWORD_EXPANSIONS = Object.freeze({
  DX: ['AI', 'AI業務自動化', '業務整理', '運用改善'],
  IT導入: ['AI', 'AI業務自動化', '業務整理', '運用改善'],
  AI導入: ['AI', 'AI業務自動化'],
  業務効率化: ['業務整理', '運用改善'],
  生産性向上: ['業務整理', '運用改善'],
  設備投資: ['金属加工', '3Dプリント', '試作'],
  製造業: ['金属加工', '3Dプリント', '試作'],
  製品開発: ['3Dプリント', '試作'],
  新規事業: ['試作', '調達進行'],
  省力化: ['業務整理', '運用改善'],
  販路開拓: ['日中貿易', '調達進行'],
})

export async function loadOrBuildDraftStore(draftStorePath = DEFAULT_DRAFT_STORE_PATH) {
  const existing = await readSeedDraftStore(draftStorePath)
  return existing || buildSeedDraftStore()
}

export function buildClosedBetaPublishedSeedStore({
  draftStore,
  reviewer,
  generatedAt = new Date().toISOString(),
  skipRoundKeys = DEFAULT_SKIP_ROUND_KEYS,
} = {}) {
  if (!draftStore) throw new Error('draftStore is required')
  if (!reviewer) {
    throw Object.assign(new Error('--reviewer is required for closed-beta publishing'), {
      code: 'SEED_PUBLISH_REVIEWER_REQUIRED',
    })
  }

  const eligibilityByRound = new Map((draftStore.eligibilityRuleDrafts || []).map((item) => [item.round_key, item]))
  const sourceById = new Map((draftStore.sourceRegistry || []).map((item) => [item.source_id, item]))
  const skipped = []
  const programs = []

  for (const round of draftStore.subsidyRoundDrafts || []) {
    const decision = evaluateClosedBetaPublishability(round, { skipRoundKeys })
    if (!decision.publish) {
      skipped.push({ roundKey: round.roundKey, reasons: decision.reasons })
      continue
    }
    programs.push(toPublishedProgram(round, {
      reviewer,
      generatedAt,
      eligibility: eligibilityByRound.get(round.roundKey),
      source: sourceById.get(round.sourceId),
    }))
  }

  programs.sort((a, b) => a.id.localeCompare(b.id))
  return {
    schema: PUBLISHED_SEED_SCHEMA,
    mode: 'closed_beta_reviewed_runtime_publish',
    generatedAt,
    reviewer,
    sourceDraftStoreSchema: draftStore.schema,
    sourceDraftPackId: draftStore.pack?.id || null,
    userSideMatchingVisible: true,
    summary: {
      draftRoundCount: draftStore.summary?.roundDraftCount || 0,
      publishedRoundCount: programs.length,
      skippedRoundCount: skipped.length,
      adoptionRatePublishedCount: 0,
      canonicalRoundWriteCount: 0,
    },
    programs,
    skipped,
  }
}

export async function writeClosedBetaPublishedSeedStore({
  draftStorePath = DEFAULT_DRAFT_STORE_PATH,
  outputPath = DEFAULT_PUBLISHED_SEED_PATH,
  reviewer,
  generatedAt,
} = {}) {
  const draftStore = await loadOrBuildDraftStore(draftStorePath)
  const publishedStore = buildClosedBetaPublishedSeedStore({ draftStore, reviewer, generatedAt })
  await writeJson(outputPath, publishedStore)
  return { outputPath, publishedStore }
}

export function evaluateClosedBetaPublishability(round, { skipRoundKeys = DEFAULT_SKIP_ROUND_KEYS } = {}) {
  const reasons = []
  if (skipRoundKeys.has(round.roundKey)) reasons.push('already_represented_in_phase1_fixture')
  if ((round.criticalMissingFields || []).length > 0) reasons.push('critical_fields_missing')
  if (!round.applicationEnd) reasons.push('application_end_missing')
  if (!round.maxAmountYen) reasons.push('max_amount_missing')
  if (!round.subsidyRate) reasons.push('subsidy_rate_missing')
  if (String(round.status || '').startsWith('closed')) reasons.push('closed_round')
  if (round.reviewRequired !== true) reasons.push('review_required_flag_missing')
  if (round.reviewStatus !== 'needs_review') reasons.push('unexpected_review_status')
  if (round.publishable === true) reasons.push('draft_should_not_be_pre_publishable')
  if (!round.officialPageUrl && (!round.sourceUrls || round.sourceUrls.length === 0)) reasons.push('source_url_missing')
  return { publish: reasons.length === 0, reasons }
}

function toPublishedProgram(round, { reviewer, generatedAt, eligibility, source }) {
  const sourceUrls = unique([
    round.officialPageUrl,
    round.guidelinePdfUrl,
    round.applicationFormUrl,
    ...(round.sourceUrls || []),
  ].filter(Boolean))
  const evidence = buildEvidence(round, sourceUrls)
  const hardRules = buildHardRules(round, eligibility)
  const softRules = buildSoftRules(round, eligibility)
  const keywords = deriveKeywords(round)

  return {
    id: round.roundKey,
    program: round.programName,
    round: round.roundName,
    sourceUrl: round.officialPageUrl || sourceUrls[0],
    lastSeenAt: dateOnly(round.lastSeenAt),
    maxLimit: {
      amountYen: round.maxAmountYen,
      display: round.maxAmountTextOriginal || yen(round.maxAmountYen),
      certainty: 'closed_beta_review_snapshot',
    },
    subsidyRate: {
      display: round.subsidyRateTextOriginal || round.subsidyRate,
      certainty: 'closed_beta_review_snapshot',
    },
    acceptStart: {
      value: toJstStart(round.applicationStart),
      display: dateDisplay(round.applicationStart),
      certainty: 'source_review_snapshot',
    },
    acceptEnd: {
      value: toJstDeadline(round.applicationEnd),
      display: round.deadlineTextOriginal || dateDisplay(round.applicationEnd),
      certainty: 'source_review_snapshot',
    },
    status: round.status || 'open',
    issuer: round.issuer || source?.owner || '公式事務局',
    requirements: buildRequirements(round, eligibility),
    requiredDocuments: round.requiredDocuments || [],
    keywords,
    hardRules,
    softRules,
    evidence,
    sourceNotes: [
      'Closed Beta用のreview snapshotです。公開前に公式サイトと公募要領を再確認してください。',
      '採択率、採択可能性、行政書士による最終判断はこのデータから推定しません。',
      ...(round.notes ? [round.notes] : []),
    ],
    sourceRecord: {
      registrySourceId: round.sourceId,
      sourceUrl: round.officialPageUrl || sourceUrls[0] || null,
      termsUrl: source?.base_url || null,
      licenseStatus: mapLicenseStatus(round.licenseStatus),
      commercialUse: round.commercialUseAllowed === true ? 'allowed' : 'restricted',
      redistribution: round.redistributionAllowed === true ? 'allowed' : 'restricted',
      automationMode: 'closed_beta_manual_review_snapshot',
      contentHash: contentHashForPublishedRound(round),
      staleAfterDays: 14,
      attribution: `${round.issuer || source?.owner || '公式出典'}, source URL, last_seen_at, and Closed Beta review caveat.`,
      transformation: 'Seed DB v0.1 draft normalized for Closed Beta matching after explicit local review.',
      displayCaveat: '公式サイトの最新情報を必ず確認してください。',
    },
    closedBetaReview: {
      reviewer,
      approvedAt: generatedAt,
      sourceRoundKey: round.roundKey,
      sourceReviewStatus: round.reviewStatus,
      sourcePublishableFlag: round.publishable,
      machineGate: 'pass',
      publicationMode: 'runtime_only',
    },
  }
}

function buildEvidence(round, sourceUrls) {
  const quoteFields = new Set((round.sourceQuotes || []).map((item) => item.field).filter(Boolean))
  return sourceUrls.map((url, index) => ({
    label: index === 0 ? 'Official source page' : `Source ${index + 1}`,
    url,
    sourceType: url.endsWith('.pdf') ? 'official_guidelines_pdf' : 'official_source_page',
    observedAt: round.lastSeenAt || null,
    supports: unique([
      'sourceUrl',
      'status',
      round.applicationStart ? 'acceptStart' : null,
      round.applicationEnd ? 'acceptEnd' : null,
      round.maxAmountYen ? 'maxLimit' : null,
      round.subsidyRate ? 'subsidyRate' : null,
      quoteFields.size > 0 ? 'requirements' : null,
      round.requiredDocuments?.length ? 'requiredDocuments' : null,
      round.businessPurposeTags?.length ? 'keywords' : null,
    ].filter(Boolean)),
    note: 'Seed DB v0.1 Closed Beta review snapshot. Official source takes precedence.',
  }))
}

function buildRequirements(round, eligibility) {
  const requirements = [
    ...(eligibility?.hard_rules || []).map((rule) => rule.label).filter(Boolean),
    ...(round.targetEntities || []).length ? `対象者: ${(round.targetEntities || []).join('・')}` : null,
    ...(round.targetArea || []).length ? `対象地域: ${(round.targetArea || []).join('・')}` : null,
    ...(round.eligibleExpenseCategories || []).length ? `対象経費候補: ${(round.eligibleExpenseCategories || []).join('・')}` : null,
    '申請前に公式サイト・公募要領・必要書類を確認してください。',
  ].filter(Boolean)
  return unique(requirements)
}

function buildHardRules(round, eligibility) {
  const hardRules = [
    ...(eligibility?.hard_rules || []).map((rule) => rule.label).filter(Boolean),
    round.applicationEnd ? `申請期限は ${round.deadlineTextOriginal || dateDisplay(round.applicationEnd)} です。` : null,
    ...(round.targetEntities || []).length ? `${(round.targetEntities || []).join('・')}が対象です。` : null,
    '公式サイトの最新情報確認が必要です。',
  ].filter(Boolean)
  return unique(hardRules)
}

function buildSoftRules(round, eligibility) {
  const softRules = [
    ...(eligibility?.soft_rules || []).map((rule) => rule.label).filter(Boolean),
    ...(round.businessPurposeTags || []).map((tag) => `${tag}に関する投資計画との整合性を確認する。`),
  ]
  return unique(softRules)
}

function deriveKeywords(round) {
  const base = unique([
    ...(round.businessPurposeTags || []),
    ...(round.eligibleExpenseCategories || []),
    ...(round.targetIndustries || []),
    ...(round.targetEntities || []),
    ...splitProgramKeywords(round.programName),
  ])
  const expanded = base.flatMap((keyword) => [keyword, ...(KEYWORD_EXPANSIONS[keyword] || [])])
  return unique(expanded).slice(0, 28)
}

function splitProgramKeywords(value) {
  return String(value || '')
    .replace(/[＜＞（）()・／/]/g, ' ')
    .split(/\s+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 2 && item.length <= 16)
}

function mapLicenseStatus(value) {
  if (value === 'green' || value === 'allowed') return 'allowed'
  if (value === 'red' || value === 'blocked') return 'blocked'
  return 'restricted'
}

function contentHashForPublishedRound(round) {
  return crypto.createHash('sha256').update(JSON.stringify({
    roundKey: round.roundKey,
    programName: round.programName,
    roundName: round.roundName,
    applicationEnd: round.applicationEnd,
    maxAmountYen: round.maxAmountYen,
    subsidyRate: round.subsidyRate,
    sourceUrls: round.sourceUrls,
    lastSeenAt: round.lastSeenAt,
  })).digest('hex')
}

function toJstStart(value) {
  if (!value) return null
  if (String(value).includes('T')) return value
  return `${value}T00:00:00+09:00`
}

function toJstDeadline(value) {
  if (!value) return null
  if (String(value).includes('T')) return value
  return `${value}T23:59:59+09:00`
}

function dateOnly(value) {
  return value ? String(value).slice(0, 10) : null
}

function dateDisplay(value) {
  if (!value) return '要確認'
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00+09:00`)
  if (Number.isNaN(date.getTime())) return String(value)
  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date)
}

function yen(value) {
  return `¥${Number(value || 0).toLocaleString('en-US')}`
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)))
}

function parseArgs(argv) {
  const options = {
    draftStorePath: DEFAULT_DRAFT_STORE_PATH,
    outputPath: DEFAULT_PUBLISHED_SEED_PATH,
    reviewer: '',
    dryRun: false,
    json: false,
  }
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--draft-store') {
      options.draftStorePath = path.resolve(argv[++index])
    } else if (arg === '--output') {
      options.outputPath = path.resolve(argv[++index])
    } else if (arg === '--reviewer') {
      options.reviewer = argv[++index]
    } else if (arg === '--dry-run') {
      options.dryRun = true
    } else if (arg === '--json') {
      options.json = true
    } else {
      throw new Error(`Unknown argument: ${arg}`)
    }
  }
  return options
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const draftStore = await loadOrBuildDraftStore(options.draftStorePath)
  const publishedStore = buildClosedBetaPublishedSeedStore({
    draftStore,
    reviewer: options.reviewer,
  })

  if (!options.dryRun) {
    await writeJson(options.outputPath, publishedStore)
  }

  const result = {
    mode: options.dryRun ? 'dry_run' : 'write_runtime_published_store',
    outputPath: options.dryRun ? null : options.outputPath,
    summary: publishedStore.summary,
  }
  if (options.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  } else {
    console.log(`seed closed-beta publish ${options.dryRun ? 'dry-run' : `wrote ${options.outputPath}`}`)
    console.log(`${publishedStore.summary.publishedRoundCount} published rounds, ${publishedStore.summary.skippedRoundCount} skipped, 0 canonical writes`)
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.stack || error.message)
    process.exit(1)
  })
}
