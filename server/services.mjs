import { promises as fs } from 'node:fs'
import path from 'node:path'
import {
  assertPublicUrl,
  daysLeft,
  getMeta,
  getTitle,
  id,
  normalizeCompanyUrl,
  nowIso,
  rootDir,
  stripHtml,
  validationError,
} from './utils.mjs'
import { accessDeniedAsNotFoundError, findOwned } from './accessBoundary.mjs'
import { getAdminSourceReview as getAdminSourceReviewRaw } from './adminReview.mjs'
import { createAuthContext, publicAuthContext } from './authContext.mjs'
import { defaultObjectStoragePort as objectStoragePort } from './objectStoragePort.mjs'
import { defaultStoreRepository as storeRepository } from './storeRepository.mjs'
import { assertServicePorts } from './servicePorts.mjs'
import { createBedrockPlanGenerator } from './bedrockPlanGenerator.mjs'
import { createClaudeCliPlanGenerator } from './claudeCliPlanGenerator.mjs'
import { getLlmBillingSummary } from './llmCostGuard.mjs'
import { activeSubsidyRounds } from './fixtures.mjs'
import { companyProfileFallbacks, DISCLAIMER, seedUser, SHORT_DISCLAIMER } from './seedData.mjs'
import {
  buildPlanConfirmationFlags,
  buildPlanSectionsLocalMock,
  buildPlanSourceReferences,
  buildRequiredDocumentChecklist,
  selectPlanTemplate,
} from './planTemplates.mjs'
import { syntheticCompanyScenarios } from '../data/fixtures/synthetic-companies.mjs'

const cachedSampleSitePath = path.join(rootDir, 'data/fixtures/company-sites/sample-corp.html')
const expertPartnersPath = path.join(rootDir, 'data/fixtures/expert-partners.json')
const syntheticCompaniesByHost = new Map(syntheticCompanyScenarios.flatMap((fixture) => {
  const primary = new URL(fixture.url).hostname.toLowerCase()
  const canonical = fixture.profile?.canonicalUrl ? new URL(fixture.profile.canonicalUrl).hostname.toLowerCase() : primary
  return [[primary, fixture], [canonical, fixture]]
}))
const REQUIRED_COMPANY_FIELDS = ['所在地', '従業員数', '資本金']
const APPLICANT_CONFIRMATION_FIELDS = [
  'prefecture',
  'city',
  'employeeCount',
  'capitalYen',
  'businessType',
  'plannedInvestmentYen',
  'estimateStatus',
  'gBizIDReadiness',
  'targetTiming',
]
const HARD_RULE_STATUS_RANK = {
  eligible: 0,
  needs_confirmation: 1,
  mismatch: 2,
}
const LOCAL_MATCHING_PROVENANCE = Object.freeze({
  matcher: 'local_keyword_signal_v1',
  subsidyDataSource: 'local_fixture_plus_closed_beta_published_seed_rounds',
  candidateSource: 'data/fixtures/subsidy-programs.json + optional data/runtime/published-seed-rounds.json',
  resultLimit: 5,
  fixedRecommendationSet: false,
})
const LOCAL_PLAN_GENERATION_PROVENANCE = Object.freeze({
  provider: 'local_mock',
  mode: 'deterministic_template',
  model: null,
  llm: false,
  adapter: 'PlanGenerator.localMock',
  phase: 'phase1_local_mvp',
})
const COMPANY_SIGNAL_DICTIONARY = [
  { keyword: '宿泊運営', aliases: ['宿泊運営', '宿泊', 'ホテル', '旅館', '民泊', '不動産運営'] },
  { keyword: 'AI業務自動化', aliases: ['AI業務自動化', 'AI', '人工知能', '自動化', '業務効率化', 'RPA'] },
  { keyword: '日中貿易', aliases: ['日中貿易', '貿易', '輸出', '輸入', '海外', '中国'] },
  { keyword: '金属加工', aliases: ['金属加工', '加工', '製造', '部品', '切削'] },
  { keyword: '3Dプリント', aliases: ['3Dプリント', '3Dプリンター', '積層造形'] },
  { keyword: '試作', aliases: ['試作', 'プロトタイプ', '新製品'] },
  { keyword: '販路開拓', aliases: ['販路開拓', '集客', 'Web', 'EC', '展示会', 'マーケティング'] },
  { keyword: '省力化', aliases: ['省力化', '人手不足', '自動化', '効率化'] },
  { keyword: '設備投資', aliases: ['設備投資', '設備導入', '機械', 'システム構築'] },
  { keyword: '事業承継', aliases: ['事業承継', 'M&A', '承継', '引継ぎ'] },
]

const localMockServicePorts = {
  SubsidyDataSource: {
    listActiveRounds: () => activeSubsidyRounds,
    getRound: (roundId) => activeSubsidyRounds.find((item) => item.roundId === roundId) || null,
  },
  DiagnosisExtractor: {
    extract: (url) => localMockExtractCompanyProfile(url),
  },
  PlanGenerator: {
    createSections: ({ profile, round, targetChars }) => buildPlanSectionsLocalMock(profile, round, { targetChars }),
  },
  Matcher: {
    match: ({ diagnosisId, profile, rounds }) => buildMatchesLocalMock(diagnosisId, profile, rounds),
  },
  AuthProvider: {
    provider: 'local_mock',
    currentUser: () => seedUser,
    devLogin: async () => {
      const authContext = createAuthContext({
        user: seedUser,
        provider: 'local_mock',
        tokenType: 'dev-token',
      })
      await storeRepository.appendAudit('auth.login', { mode: 'local_mock' })
      return {
        token: 'dev-token',
        user: seedUser,
        authContext: publicAuthContext(authContext),
      }
    },
  },
  Notifier: {
    createExpertWaitlistLead: (payload) => localMockCreateExpertWaitlistLead(payload),
    updateSettings: (settings) => localMockUpdateNotificationSettings(settings),
  },
  SubmissionAdapter: {
    submit: ({ plan, payload = {} }) => localMockSubmitBlocked({ plan, payload }),
  },
}

let servicePorts = assertServicePorts(localMockServicePorts)

export function configureServicePorts(overrides = {}) {
  servicePorts = assertServicePorts(mergeServicePorts(localMockServicePorts, overrides))
  return servicePorts
}

export function resetServicePorts() {
  servicePorts = assertServicePorts(localMockServicePorts)
  return servicePorts
}

export function getServicePorts() {
  return servicePorts
}

export function configureServicePortsFromEnv(env = process.env) {
  const llmProvider = String(env.LLM_PROVIDER || 'local').toLowerCase()
  if (llmProvider === 'bedrock') {
    return configureServicePorts({
      PlanGenerator: createBedrockPlanGenerator({ env }),
    })
  }
  if (llmProvider === 'claude_cli') {
    return configureServicePorts({
      PlanGenerator: createClaudeCliPlanGenerator({ env }),
    })
  }
  if (llmProvider === 'local' || llmProvider === 'mock') {
    return resetServicePorts()
  }
  throw Object.assign(new Error(`Unsupported LLM_PROVIDER: ${llmProvider}`), {
    code: 'LLM_PROVIDER_UNSUPPORTED',
    status: 400,
  })
}

export function authUser() {
  return authContext().user
}

export function authContext() {
  const user = servicePorts.AuthProvider.currentUser()
  return createAuthContext({
    user,
    provider: servicePorts.AuthProvider.provider || user?.authProvider || 'local_mock',
    tokenType: user?.tokenType || 'implicit-current-user',
  })
}

function currentAccessScope() {
  return authContext().accessScope
}

export async function getAdminSourceReview(options = {}) {
  const context = assertAdminAccess()
  const review = await getAdminSourceReviewRaw(options)
  await storeRepository.appendAudit('admin.source_reviewed', {
    reviewedDate: review.reviewedDate,
    mode: review.mode,
    scope: review.scope,
    subsidyCount: review.summary.subsidyCount,
    expertCount: review.summary.expertCount,
    warningCount: review.summary.warningsCount,
  }, context.accessScope)
  return review
}

export async function getLlmUsageSummary(options = {}) {
  const context = authContext()
  if (!['admin', 'system_admin', 'owner'].includes(context.role)) {
    throw Object.assign(new Error('管理者権限を確認してください'), {
      status: 403,
      code: 'FORBIDDEN',
      details: { requiredRole: 'owner', currentRole: context.role },
    })
  }
  const summary = await getLlmBillingSummary(options)
  await storeRepository.appendAudit('admin.llm_usage_viewed', {
    runCount: summary.totals.runCount,
    monthActualCostUsd: summary.totals.monthActualCostUsd,
    enabled: summary.enabled,
  }, context.accessScope)
  return summary
}

function assertAdminAccess() {
  const context = authContext()
  if (!['admin', 'system_admin'].includes(context.role)) {
    throw Object.assign(new Error('管理者権限を確認してください'), {
      status: 403,
      code: 'FORBIDDEN',
      details: { requiredRole: 'admin', currentRole: context.role },
    })
  }
  return context
}

export async function devLogin() {
  return servicePorts.AuthProvider.devLogin()
}

export async function createDiagnosis(inputUrl, options = {}) {
  const scope = currentAccessScope()
  if (options.attested !== true) {
    throw validationError('ご自身が管理する自社サイトであることを確認してください')
  }
  const url = normalizeCompanyUrl(inputUrl)
  await assertPublicUrl(url)

  const diagnosisId = id('diag')
  const companyId = id('company')
  const startedAt = nowIso()

  await storeRepository.mutate((store) => {
    store.companies.push({
      id: companyId,
      userId: scope.userId,
      name: null,
      url: url.href,
      prefecture: null,
      city: null,
      profile: null,
      sourceCitations: [],
      analyzedAt: null,
      createdAt: startedAt,
    })
    store.diagnoses.push({
      id: diagnosisId,
      userId: scope.userId,
      companyId,
      status: 'scraping',
      inputUrl: url.href,
      error: null,
      matchCount: null,
      totalLimit: null,
      saved: false,
      progress: 5,
      events: [
        {
          event: 'diagnosis.status',
          data: { status: 'scraping', label: '会社サイトを確認しています' },
          createdAt: startedAt,
        },
      ],
      startedAt,
      completedAt: null,
    })
  })

  runDiagnosis(diagnosisId, url, scope.userId).catch(async (error) => {
    await storeRepository.mutate((store) => {
      const diagnosis = store.diagnoses.find((item) => item.id === diagnosisId && item.userId === scope.userId)
      if (!diagnosis) return
      diagnosis.status = 'failed'
      diagnosis.error = { code: error.code || 'MATCHING_FAILED', message: error.message }
      diagnosis.events.push({
        event: 'diagnosis.error',
        data: diagnosis.error,
        createdAt: nowIso(),
      })
    })
  })

  await storeRepository.appendAudit('diagnosis.started', {
    diagnosisId,
    companyId,
    inputUrl: url.href,
    attested: true,
  }, scope)
  return { diagnosisId, companyId, status: 'scraping' }
}

async function runDiagnosis(diagnosisId, url, userId) {
  await delay(250)
  await pushDiagnosisEvent(diagnosisId, userId, 'extracting', 35, '事業内容を整理しています')
  const { profile, html, finalUrl, warnings } = await servicePorts.DiagnosisExtractor.extract(url)

  await storeRepository.mutate((store) => {
    const diagnosis = store.diagnoses.find((item) => item.id === diagnosisId && item.userId === userId)
    const company = store.companies.find((item) => item.id === diagnosis?.companyId && item.userId === userId)
    if (!diagnosis || !company) return
    company.name = profile.name
    company.prefecture = profile.prefecture
    company.city = profile.city
    company.profile = profile
    company.sourceCitations = profile.citations
    company.analyzedAt = nowIso()
    diagnosis.scrape = {
      finalUrl,
      htmlBytes: Buffer.byteLength(html || ''),
      warnings,
    }
  })

  await delay(250)
  await pushDiagnosisEvent(diagnosisId, userId, 'matching', 70, '補助金制度と照合しています')
  const matches = servicePorts.Matcher.match({
    diagnosisId,
    profile,
    rounds: servicePorts.SubsidyDataSource.listActiveRounds(),
  }).map((match) => ({ ...match, userId }))

  await delay(250)
  await storeRepository.mutate((store) => {
    const diagnosis = store.diagnoses.find((item) => item.id === diagnosisId && item.userId === userId)
    if (!diagnosis) return
    const matchingProvenance = buildMatchingProvenance(profile, matches)
    store.matches = store.matches.filter((item) => item.diagnosisId !== diagnosisId)
    store.matches.push(...matches)
    diagnosis.status = 'done'
    diagnosis.progress = 100
    diagnosis.matchCount = matches.length
    diagnosis.totalLimit = matches.reduce((sum, match) => sum + match.maxLimit, 0)
    diagnosis.matchingProvenance = matchingProvenance
    diagnosis.completedAt = nowIso()
    diagnosis.events.push({
      event: 'diagnosis.done',
      data: {
        diagnosisId,
        matchCount: diagnosis.matchCount,
        totalLimit: diagnosis.totalLimit,
        matchingProvenance,
      },
      createdAt: nowIso(),
    })
  })
  await storeRepository.appendAudit(
    'diagnosis.completed',
    {
      diagnosisId,
      matchCount: matches.length,
      matchingProvenance: buildMatchingProvenance(profile, matches),
      companySourceType: profile.sourceType,
    },
    userId,
  )
}

async function pushDiagnosisEvent(diagnosisId, userId, status, progress, message) {
  await storeRepository.mutate((store) => {
    const diagnosis = store.diagnoses.find((item) => item.id === diagnosisId && item.userId === userId)
    if (!diagnosis) return
    diagnosis.status = status
    diagnosis.progress = progress
    diagnosis.events.push({
      event: 'diagnosis.progress',
      data: { step: status, progress, message },
      createdAt: nowIso(),
    })
  })
}

function mergeServicePorts(base, overrides) {
  const merged = {}
  for (const [portName, adapter] of Object.entries(base)) {
    merged[portName] = {
      ...adapter,
      ...(overrides[portName] || {}),
    }
  }
  return merged
}

async function localMockExtractCompanyProfile(url) {
  const warnings = []
  let html = ''
  let finalUrl = url.href

  const syntheticFixture = syntheticFixtureForHost(url.hostname)
  if (syntheticFixture) {
    html = syntheticFixture.html
    finalUrl = syntheticFixture.profile?.canonicalUrl || url.href
    warnings.push(`開発用合成会社fixtureを使用しました: ${syntheticFixture.id}`)
    const profile = profileFromHtml(url, html, finalUrl)
    profile.sourceType = 'synthetic_fixture'
    profile.fixtureId = syntheticFixture.id
    return { profile, html, finalUrl, warnings }
  }

  try {
    const response = await fetchPublicUrl(url)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    finalUrl = response.url
    html = await response.text()
  } catch (error) {
    warnings.push(`会社サイトの取得に失敗したため、開発用キャッシュを使用しました: ${error.message}`)
    html = await readCachedCompanySite(url.hostname)
  }

  const profile = profileFromHtml(url, html, finalUrl)
  return { profile, html, finalUrl, warnings }
}

export async function fetchPublicUrl(initialUrl, maxRedirects = 3) {
  let current = initialUrl instanceof URL ? initialUrl : normalizeCompanyUrl(initialUrl)
  await assertPublicUrl(current)

  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 6000)
    let response
    try {
      response = await fetch(current.href, {
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          'user-agent': 'HojokinPocketDevBot/0.1 (+local MVP test)',
        },
      })
    } finally {
      clearTimeout(timeout)
    }

    if (![301, 302, 303, 307, 308].includes(response.status)) {
      return response
    }

    const location = response.headers.get('location')
    if (!location) return response
    current = await validateRedirectLocation(current, location)
  }

  throw Object.assign(new Error('リダイレクトが多すぎます'), { code: 'URL_NOT_ACCESSIBLE' })
}

export async function validateRedirectLocation(currentUrl, location) {
  const base = currentUrl instanceof URL ? currentUrl : normalizeCompanyUrl(currentUrl)
  const redirected = normalizeCompanyUrl(new URL(location, base.href).href)
  await assertPublicUrl(redirected)
  return redirected
}

async function readCachedCompanySite(hostname) {
  const syntheticFixture = syntheticFixtureForHost(hostname)
  if (syntheticFixture) {
    return syntheticFixture.html
  }
  if (hostname.includes('sample-corp.example')) {
    return fs.readFile(cachedSampleSitePath, 'utf8')
  }
  throw Object.assign(new Error('会社サイトを確認できませんでした'), { code: 'URL_NOT_ACCESSIBLE' })
}

function syntheticFixtureForHost(hostname) {
  if (process.env.SYNTHETIC_FIXTURE_MODE !== '1') return null
  return syntheticCompaniesByHost.get(String(hostname || '').toLowerCase()) || null
}

function profileFromHtml(inputUrl, html, finalUrl) {
  const host = inputUrl.hostname.toLowerCase()
  const fallback = companyProfileFallbacks[host] || syntheticFixtureForHost(host)?.profile
  const title = getTitle(html)
  const description = getMeta(html, 'description') || getMeta(html, 'og:description')
  const visibleText = stripHtml(html)
  const headings = extractHeadings(html)
  const rawName = getMeta(html, 'og:title') || title || fallback?.name || host
  const name = rawName.split('|')[0].trim()
  const summary = description || fallback?.businessSummary || visibleText.slice(0, 220)
  const keywords = extractKeywords(`${summary} ${headings.join(' ')} ${visibleText}`, fallback?.keywords || [])
  const evidenceSnippets = buildCompanyEvidenceSnippets(visibleText, keywords)
  const unknowns = fallback?.unknowns || inferUnknowns(visibleText)
  const extractionQuality = scoreExtractionQuality({ description, visibleText, keywords, evidenceSnippets, unknowns })
  const citations = [
    {
      url: finalUrl,
      label: description ? '公式サイト meta description' : '公式サイト本文',
    },
  ]

  return {
    id: fallback?.id || id('company_profile'),
    name,
    url: inputUrl.href,
    prefecture: fallback?.prefecture || null,
    city: fallback?.city || null,
    businessSummary: summary,
    pageTitle: title,
    headings: headings.slice(0, 8),
    keywords,
    evidenceSnippets,
    extractionQuality,
    unknowns,
    citations,
    sourceType: finalUrl === inputUrl.href ? 'live_fetch' : 'live_fetch_redirect',
    extractedAt: nowIso(),
  }
}

function extractKeywords(text, preferred = []) {
  const found = []
  for (const entry of COMPANY_SIGNAL_DICTIONARY) {
    if (entry.aliases.some((alias) => text.includes(alias))) {
      found.push(entry.keyword)
    }
  }
  return Array.from(new Set([...preferred, ...found])).slice(0, 12)
}

function extractHeadings(html) {
  const headings = []
  const pattern = /<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi
  let match = pattern.exec(String(html || ''))
  while (match && headings.length < 12) {
    const text = stripHtml(match[1])
    if (text) headings.push(text)
    match = pattern.exec(String(html || ''))
  }
  return headings
}

function buildCompanyEvidenceSnippets(text, keywords) {
  const snippets = []
  const source = String(text || '')
  for (const keyword of keywords) {
    const aliases = COMPANY_SIGNAL_DICTIONARY.find((item) => item.keyword === keyword)?.aliases || [keyword]
    const alias = aliases.find((item) => source.includes(item))
    if (!alias) continue
    const index = source.indexOf(alias)
    const start = Math.max(0, index - 48)
    const end = Math.min(source.length, index + alias.length + 72)
    snippets.push({
      keyword,
      snippet: source.slice(start, end).replace(/\s+/g, ' ').trim(),
    })
  }
  return snippets.slice(0, 6)
}

function inferUnknowns(visibleText) {
  const text = String(visibleText || '')
  return REQUIRED_COMPANY_FIELDS.filter((field) => {
    if (field === '所在地') return !/(所在地|住所|本社|東京都|大阪府|京都府|北海道|県|市|区)/.test(text)
    if (field === '従業員数') return !/(従業員|社員数|スタッフ)[^\d０-９]{0,12}[\d０-９]/.test(text)
    if (field === '資本金') return !/(資本金)[^\d０-９]{0,12}[\d０-９]/.test(text)
    return true
  })
}

function scoreExtractionQuality({ description, visibleText, keywords, evidenceSnippets, unknowns }) {
  const score =
    (description ? 2.0 : 0.8) +
    (visibleText?.length > 400 ? 2.0 : visibleText?.length > 120 ? 1.2 : 0.4) +
    Math.min(2.0, keywords.length * 0.35) +
    Math.min(2.0, evidenceSnippets.length * 0.45) +
    Math.max(0, 2.0 - unknowns.length * 0.45)
  return {
    score: round1(Math.min(10, score)),
    level: score >= 8.5 ? 'usable' : score >= 7 ? 'needs_confirmation' : 'low_confidence',
    missingFields: unknowns,
  }
}

function buildMatchesLocalMock(diagnosisId, profile, rounds = activeSubsidyRounds) {
  const profileWords = new Set(profile.keywords)
  return rounds
    .map((round) => {
      const overlap = round.keywords.filter((keyword) => profileWords.has(keyword) || profile.businessSummary.includes(keyword))
      const scoring = scoreMatch(round, profile, overlap)
      const hardRule = evaluateHardRules(round, profile)
      return {
        id: id('match'),
        diagnosisId,
        roundId: round.roundId,
        rank: 0,
        eligible: round.status !== 'closed',
        hardRuleStatus: hardRule.status,
        hardRule,
        softFit: {
          score: scoring.breakdown.total10,
          score100: scoring.matchScore,
          confidenceScore: scoring.confidenceScore,
          breakdown: scoring.breakdown,
        },
        matchScore: scoring.matchScore,
        confidenceScore: scoring.confidenceScore,
        scoreBreakdown: scoring.breakdown,
        signalMatched: overlap.length > 0,
        recommendationLevel: scoring.level,
        programName: round.program.name,
        roundLabel: round.roundLabel,
        issuer: round.program.issuer,
        maxLimit: round.maxLimit,
        subsidyRate: round.subsidyRate,
        acceptEnd: round.acceptEnd,
        daysLeft: daysLeft(round.acceptEnd),
        adoptionRate: round.adoptionRate,
        adoptionRateSource: round.adoptionRateSource,
        adoptionRateLabel: round.adoptionRateSource ? null : '公開された採択率データは未確認です',
        reasons: buildReasons(round, profile, overlap),
        proposal: buildProposal(round, profile, overlap, scoring),
        evidence: buildMatchEvidence(round, profile, overlap),
        warnings: hardRule.warnings
          .concat(round.sourceRefresh?.warning ? [round.sourceRefresh.warning] : []),
        lastSeenAt: round.lastSeenAt,
        sourceRefresh: round.sourceRefresh,
      }
    })
    .filter((match) => match.eligible)
    .filter((match) => match.signalMatched || profile.sourceType === 'synthetic_fixture')
    .sort((a, b) => b.matchScore - a.matchScore)
    .sort((a, b) => (HARD_RULE_STATUS_RANK[a.hardRuleStatus] ?? 9) - (HARD_RULE_STATUS_RANK[b.hardRuleStatus] ?? 9))
    .slice(0, 5)
    .map((match, index) => ({ ...match, rank: index + 1 }))
}

function buildMatchingProvenance(profile, matches = []) {
  const companySourceType = profile?.sourceType || null
  const syntheticFixtureMode = companySourceType === 'synthetic_fixture'
  const directSignalRequired = !syntheticFixtureMode
  return {
    ...LOCAL_MATCHING_PROVENANCE,
    companySourceType,
    directSignalRequired,
    syntheticFixtureMode,
    filterPolicy: directSignalRequired
      ? 'require_company_subsidy_keyword_overlap'
      : 'synthetic_fixture_allows_broad_qa_matches',
    returnedMatchCount: matches.length,
    directSignalMatchedCount: matches.filter((match) => match.signalMatched === true).length,
  }
}

function evaluateHardRules(round, profile) {
  const confirmation = profile.applicantConfirmations || null
  const answers = confirmation?.answers || {}
  const checks = []

  const addCheck = (field, status, label, description, extra = {}) => {
    checks.push({
      field,
      status,
      label,
      description,
      ...extra,
    })
  }

  if (!confirmation) {
    for (const field of APPLICANT_CONFIRMATION_FIELDS) {
      addCheck(field, 'needs_confirmation', applicantFieldLabel(field), `${applicantFieldLabel(field)}は申請者確認が未入力です。`)
    }
  } else {
    for (const field of APPLICANT_CONFIRMATION_FIELDS) {
      const value = answers[field]
      if (value === null || value === undefined || value === '' || value === 'unknown') {
        addCheck(field, 'needs_confirmation', applicantFieldLabel(field), `${applicantFieldLabel(field)}を確認してください。`)
      } else {
        addCheck(field, 'eligible', applicantFieldLabel(field), `${applicantFieldLabel(field)}は申請者回答で確認済みです。`, {
          actual: value,
        })
      }
    }
  }

  const sizeCheck = evaluateBusinessSize(round, answers)
  if (sizeCheck) checks.push(sizeCheck)

  const timingCheck = evaluateTargetTiming(round, answers)
  if (timingCheck) checks.push(timingCheck)

  const gBizCheck = evaluateGBizIdReadiness(round, answers)
  if (gBizCheck) checks.push(gBizCheck)

  const investmentCheck = evaluateInvestmentReadiness(round, answers)
  if (investmentCheck) checks.push(investmentCheck)

  for (const warning of confirmation?.warnings || []) {
    addCheck('contradiction', 'needs_confirmation', '公開情報との差分', warning)
  }

  const status = checks.some((check) => check.status === 'mismatch')
    ? 'mismatch'
    : checks.some((check) => check.status === 'needs_confirmation')
      ? 'needs_confirmation'
      : 'eligible'

  const warnings = checks
    .filter((check) => check.status !== 'eligible')
    .map((check) => check.description)

  return {
    status,
    checks,
    warnings,
    confirmedFields: confirmation?.confirmedFields || [],
    source: confirmation ? 'applicant_confirmation' : 'public_site_only',
    evaluatedAt: nowIso(),
  }
}

function evaluateBusinessSize(round, answers) {
  const businessType = answers.businessType || 'unknown'
  const employeeCount = finiteNumberOrNull(answers.employeeCount)
  const capitalYen = finiteNumberOrNull(answers.capitalYen)

  if (businessType === 'large_company') {
    return {
      field: 'businessSize',
      status: 'mismatch',
      label: '事業者区分',
      description: '大企業として回答されています。現在のローカル候補は中小企業・小規模事業者向けのため条件不一致です。',
      actual: businessType,
    }
  }

  if (businessType === 'unknown' || employeeCount === null || capitalYen === null) {
    return {
      field: 'businessSize',
      status: 'needs_confirmation',
      label: '事業者規模',
      description: '事業者区分、従業員数、資本金を確認すると対象者要件を判定できます。',
    }
  }

  if (employeeCount < 0 || capitalYen < 0) {
    return {
      field: 'businessSize',
      status: 'mismatch',
      label: '事業者規模',
      description: '従業員数または資本金が負の値です。入力内容を確認するまで対象者要件は条件不一致として扱います。',
      actual: { employeeCount, capitalYen },
      expected: '0以上の数値',
    }
  }

  const isJizokuka = round.roundId === 'jizokuka-normal-20'
  if (isJizokuka && employeeCount > 20) {
    return {
      field: 'businessSize',
      status: 'mismatch',
      label: '小規模事業者要件',
      description: '従業員数が20名を超えているため、小規模事業者向け候補は条件不一致として扱います。',
      actual: employeeCount,
      expected: '20名以下',
    }
  }

  if (!isJizokuka && (employeeCount > 300 || capitalYen > 300_000_000)) {
    return {
      field: 'businessSize',
      status: 'mismatch',
      label: '中小企業要件',
      description: '従業員数または資本金がローカル判定の中小企業目安を超えています。公式要件の確認が必要です。',
      actual: { employeeCount, capitalYen },
      expected: '従業員300名以下・資本金3億円以下の目安',
    }
  }

  return {
    field: 'businessSize',
    status: 'eligible',
    label: '事業者規模',
    description: '申請者回答ではローカルの事業者規模チェックを満たしています。',
    actual: { businessType, employeeCount, capitalYen },
  }
}

function evaluateTargetTiming(round, answers) {
  const targetTiming = answers.targetTiming || 'unknown'
  const remainingDays = daysLeft(round.acceptEnd)

  if (targetTiming === 'unknown' || targetTiming === 'undecided') {
    return {
      field: 'targetTiming',
      status: 'needs_confirmation',
      label: '申請時期',
      description: '申請したい時期が未確定です。締切と準備期間を確認してください。',
    }
  }

  if (Number.isFinite(remainingDays) && remainingDays >= 0 && targetTiming === 'after_3_months' && remainingDays < 90) {
    return {
      field: 'targetTiming',
      status: 'mismatch',
      label: '申請時期',
      description: '希望時期が3か月より後ですが、この候補の締切は90日以内です。',
      actual: targetTiming,
      expected: `${remainingDays}日以内に準備`,
    }
  }

  if (round.status === 'upcoming' && targetTiming === 'within_30_days') {
    return {
      field: 'targetTiming',
      status: 'needs_confirmation',
      label: '受付開始前',
      description: 'この候補は受付開始前です。公式の受付開始日を確認してください。',
      actual: targetTiming,
    }
  }

  return {
    field: 'targetTiming',
    status: 'eligible',
    label: '申請時期',
    description: '申請者回答の希望時期は現在の候補スケジュールと大きく矛盾していません。',
    actual: targetTiming,
  }
}

function evaluateGBizIdReadiness(round, answers) {
  const requiresGBizId = round.requirements.some((requirement) => /GビズID|Jグランツ|電子申請/.test(requirement.description || requirement.label || ''))
  if (!requiresGBizId) return null

  const readiness = answers.gBizIDReadiness || 'unknown'
  const remainingDays = daysLeft(round.acceptEnd)
  if (readiness === 'ready') {
    return {
      field: 'gBizIDReadiness',
      status: 'eligible',
      label: 'GビズID',
      description: 'GビズIDは準備済みとして回答されています。',
      actual: readiness,
    }
  }
  if (readiness === 'applying') {
    return {
      field: 'gBizIDReadiness',
      status: 'needs_confirmation',
      label: 'GビズID',
      description: 'GビズIDは申請中です。取得完了日と締切を確認してください。',
      actual: readiness,
    }
  }
  if (readiness === 'not_started' && Number.isFinite(remainingDays) && remainingDays <= 21) {
    return {
      field: 'gBizIDReadiness',
      status: 'mismatch',
      label: 'GビズID',
      description: 'GビズID未着手で締切まで21日以内のため、ローカル判定では条件不一致として扱います。',
      actual: readiness,
      expected: '締切前にGビズIDプライム取得',
    }
  }
  return {
    field: 'gBizIDReadiness',
    status: 'needs_confirmation',
    label: 'GビズID',
    description: 'GビズIDの準備状況を確認してください。',
    actual: readiness,
  }
}

function evaluateInvestmentReadiness(round, answers) {
  const investment = finiteNumberOrNull(answers.plannedInvestmentYen)
  const estimateStatus = answers.estimateStatus || 'unknown'
  if (investment === null) {
    return {
      field: 'plannedInvestmentYen',
      status: 'needs_confirmation',
      label: '投資予定額',
      description: '投資予定額が未確認です。対象経費の規模を確認してください。',
    }
  }
  if (investment <= 0) {
    return {
      field: 'plannedInvestmentYen',
      status: 'mismatch',
      label: '投資予定額',
      description: '投資予定額が0円以下のため、補助対象経費の候補が確認できません。',
      actual: investment,
    }
  }
  if (round.roundId === 'shoryokuka-ippan-7' && investment < 500_000) {
    return {
      field: 'plannedInvestmentYen',
      status: 'mismatch',
      label: '省力化投資の見積規模',
      description: '省力化候補は50万円以上の見積で相見積確認が必要になるため、投資予定額が条件に届いていません。',
      actual: investment,
      expected: '50万円以上',
    }
  }
  if (['unknown', 'not_started'].includes(estimateStatus)) {
    return {
      field: 'estimateStatus',
      status: 'needs_confirmation',
      label: '見積状況',
      description: '見積の取得状況が未確定です。対象経費と見積根拠を確認してください。',
      actual: estimateStatus,
    }
  }
  if (round.roundId === 'shoryokuka-ippan-7' && estimateStatus === 'not_required') {
    return {
      field: 'estimateStatus',
      status: 'needs_confirmation',
      label: '相見積',
      description: '省力化候補では見積額50万円以上の場合に相見積が必要になるため、見積不要の回答は公式要件で再確認してください。',
      actual: estimateStatus,
    }
  }
  return {
    field: 'plannedInvestmentYen',
    status: 'eligible',
    label: '投資・見積',
    description: '投資予定額と見積状況は申請者回答で確認済みです。',
    actual: { plannedInvestmentYen: investment, estimateStatus },
  }
}

function applicantFieldLabel(field) {
  return {
    prefecture: '都道府県',
    city: '市区町村',
    employeeCount: '従業員数',
    capitalYen: '資本金',
    businessType: '事業者区分',
    plannedInvestmentYen: '投資予定額',
    estimateStatus: '見積状況',
    gBizIDReadiness: 'GビズID',
    targetTiming: '申請希望時期',
  }[field] || field
}

function scoreMatch(round, profile, overlap) {
  const hardMismatch = hasHardRoundMismatch(round, profile)
  const baseKeywordScore = Math.min(3, overlap.length * 0.9)
  const keywordScore = hardMismatch ? Math.min(0.4, baseKeywordScore) : baseKeywordScore
  const baseRequirementScore = Math.min(3, round.requirements.reduce((sum, requirement) => {
    if (requirement.result === 'fit') return sum + (requirement.kind === 'hard' ? 1.5 : 1.2)
    if (requirement.result === 'partial') return sum + 0.75
    if (requirement.result === 'needs_confirmation') return sum + (requirement.kind === 'hard' ? 0.45 : 0.65)
    return sum
  }, 0))
  const requirementScore = hardMismatch ? Math.min(1.2, baseRequirementScore) : baseRequirementScore
  const availabilityScore = round.status === 'open' ? 1 : round.status === 'upcoming' ? 0.85 : 0.2
  const sourceScore = round.program?.sourceUrl && round.lastSeenAt ? 1 : 0.35
  const companyScore = Math.min(2, Math.max(0.5, profile.extractionQuality?.score / 5 || 1))
  const total10 = keywordScore + requirementScore + availabilityScore + sourceScore + companyScore
  const matchScore = Math.round(Math.min(98, total10 * 10))
  const confidenceScore = Math.round(Math.min(95, ((keywordScore + sourceScore + companyScore) / 6) * 100))
  return {
    matchScore,
    confidenceScore,
    level: matchScore >= 86 ? 'strong' : matchScore >= 76 ? 'good' : matchScore >= 65 ? 'review' : 'low',
    breakdown: {
      keywordFit: round1(keywordScore),
      requirementFit: round1(requirementScore),
      availability: round1(availabilityScore),
      sourceReliability: round1(sourceScore),
      companyEvidence: round1(companyScore),
      total10: round1(Math.min(10, total10)),
    },
  }
}

function hasHardRoundMismatch(round, profile) {
  if (!/shoukei|承継|M&A|PMI/i.test(`${round.roundId} ${round.program?.name || ''} ${round.roundLabel || ''}`)) {
    return false
  }
  const text = [
    profile.businessSummary,
    ...(profile.keywords || []),
    ...(profile.headings || []),
  ].join(' ')
  return !/(事業承継|M&A|PMI|後継者|親族内承継|従業員承継|廃業|再チャレンジ)/i.test(text)
}

function buildReasons(round, profile, overlap) {
  const reasons = []
  if (overlap.length > 0) {
    reasons.push({
      type: 'fit',
      label: `${overlap.slice(0, 2).join('・')}に関連`,
      description: `会社サイトから「${overlap.slice(0, 3).join('」「')}」に関する記載を確認しました。`,
    })
  }
  if (profile.unknowns?.length) {
    reasons.push({
      type: 'warning',
      label: '確認が必要な会社情報があります',
      description: `${profile.unknowns.join('、')}を補足すると判定精度が上がります。`,
    })
  }
  reasons.push({
    type: 'source',
    label: '出典付き候補',
    description: `制度公式ページを ${formatDate(round.lastSeenAt)} に確認した候補です。`,
  })
  return reasons.slice(0, 3)
}

function buildProposal(round, profile, overlap, scoring) {
  const firstKeyword = overlap[0] || profile.keywords[0] || '公開情報'
  return {
    title: `${firstKeyword}を軸に${round.program.name}を検討できます`,
    summary: `${profile.name}の公開サイトから確認できた事業内容と、${round.roundLabel}の対象テーマを照合しました。`,
    whyThisFits: [
      overlap.length > 0
        ? `会社サイトに「${overlap.slice(0, 3).join('」「')}」に関する記載があります。`
        : '公開情報だけでは直接キーワードが少ないため、補足情報で精度確認が必要です。',
      `${round.program.name}は${round.program.overview}`,
      `現時点の内部評価は${scoring.breakdown.total10}/10です。要確認項目を補足すると精度が上がります。`,
    ],
    nextActions: [
      '従業員数・資本金・所在地を確認',
      '投資予定内容と見積の有無を整理',
      '公式公募要領で対象経費と締切を確認',
      '事業計画書の下書きを本人確認用に編集',
    ],
    caveats: [
      '採択率や採択可能性の保証ではありません。',
      '最終的な制度要件は公式公募要領で確認してください。',
    ],
  }
}

function buildMatchEvidence(round, profile, overlap) {
  return {
    company: (profile.evidenceSnippets || [])
      .filter((item) => overlap.includes(item.keyword) || overlap.length === 0)
      .slice(0, 3)
      .map((item) => ({
        keyword: item.keyword,
        snippet: item.snippet,
        sourceUrl: profile.citations?.[0]?.url || profile.url,
      })),
    subsidy: {
      sourceUrl: round.program.sourceUrl,
      lastSeenAt: round.lastSeenAt,
      sourceRefresh: round.sourceRefresh,
      requirements: round.requirements.map((requirement) => ({
        label: requirement.label,
        result: requirement.result,
        description: requirement.description,
      })),
    },
  }
}

export async function getDiagnosis(idValue) {
  const scope = currentAccessScope()
  const bundle = await storeRepository.getDiagnosisBundleForUser(scope, idValue)
  if (!bundle) return null
  const { diagnosis, company } = bundle
  await storeRepository.appendAudit('diagnosis.viewed', {
    diagnosisId: diagnosis.id,
    status: diagnosis.status,
    matchCount: diagnosis.matchCount || 0,
  }, scope)
  return {
    id: diagnosis.id,
    status: diagnosis.status,
    inputUrl: diagnosis.inputUrl,
    matchCount: diagnosis.matchCount,
    totalLimit: diagnosis.totalLimit,
    error: diagnosis.error,
    progress: diagnosis.progress,
    company: company
      ? {
          id: company.id,
          name: company.name,
          prefecture: company.prefecture,
          city: company.city,
          businessSummary: company.profile?.businessSummary,
          keywords: company.profile?.keywords || [],
          extractionQuality: company.profile?.extractionQuality || null,
          evidenceSnippets: company.profile?.evidenceSnippets || [],
          unknowns: company.profile?.unknowns || [],
          citations: company.profile?.citations || [],
          sourceType: company.profile?.sourceType || null,
          extractedAt: company.profile?.extractedAt || null,
        }
      : null,
    matchingProvenance: diagnosis.matchingProvenance || (company?.profile ? buildMatchingProvenance(company.profile, bundle.matches || []) : null),
    applicantConfirmations: diagnosis.applicantConfirmations || null,
    startedAt: diagnosis.startedAt,
    completedAt: diagnosis.completedAt,
  }
}

export async function getDiagnosisEvents(idValue) {
  const bundle = await storeRepository.getDiagnosisBundleForUser(currentAccessScope(), idValue)
  const diagnosis = bundle?.diagnosis
  return diagnosis?.events || []
}

export async function getMatches(diagnosisId, { audit = true } = {}) {
  const scope = currentAccessScope()
  const bundle = await storeRepository.getDiagnosisBundleForUser(scope, diagnosisId)
  if (!bundle) return null
  const { diagnosis, company } = bundle
  const matches = bundle.matches
    .filter((item) => item.diagnosisId === diagnosisId && item.eligible)
    .sort((a, b) => a.rank - b.rank)
  const result = {
    diagnosisId,
    company: company?.profile
      ? {
          id: company.id,
          name: company.profile.name,
          prefecture: company.profile.prefecture,
          city: company.profile.city,
          businessSummary: company.profile.businessSummary,
          keywords: company.profile.keywords,
          extractionQuality: company.profile.extractionQuality,
          evidenceSnippets: company.profile.evidenceSnippets,
          unknowns: company.profile.unknowns,
          citations: company.profile.citations,
        }
      : null,
    applicantConfirmations: diagnosis.applicantConfirmations || null,
    summary: {
      matchCount: matches.length,
      totalLimit: matches.reduce((sum, match) => sum + match.maxLimit, 0),
      lastUpdatedAt: diagnosis.updatedAt || diagnosis.completedAt || diagnosis.startedAt,
      hardRuleCounts: summarizeHardRuleStatuses(matches),
    },
    provenance: diagnosis.matchingProvenance || buildMatchingProvenance(company?.profile, matches),
    matches,
  }
  if (audit) {
    await storeRepository.appendAudit('match.viewed', {
      diagnosisId,
      matchCount: matches.length,
      roundIds: matches.map((match) => match.roundId).filter(Boolean),
    }, scope)
  }
  return result
}

export async function updateApplicantConfirmations(diagnosisId, payload = {}) {
  const scope = currentAccessScope()
  let updatedResult = null
  await storeRepository.mutate((store) => {
    const diagnosis = findOwned(store.diagnoses, scope, (item) => item.id === diagnosisId)
    if (!diagnosis) throw accessDeniedAsNotFoundError('diagnosis')
    if (diagnosis.status !== 'done') {
      throw Object.assign(new Error('診断完了後に確認情報を保存してください'), { status: 409, code: 'DIAGNOSIS_NOT_READY' })
    }
    const company = findOwned(store.companies, scope, (item) => item.id === diagnosis.companyId)
    if (!company?.profile) throw Object.assign(new Error('会社情報が見つかりません'), { status: 404, code: 'NOT_FOUND' })

    const previous = diagnosis.applicantConfirmations || null
    const applicantConfirmations = normalizeApplicantConfirmations(payload.answers || payload, {
      previous,
      diagnosis,
      company,
      profile: company.profile,
    })
    diagnosis.applicantConfirmations = applicantConfirmations
    company.applicantConfirmations = applicantConfirmations
    company.profile.applicantConfirmations = applicantConfirmations
    store.applicantConfirmations = (store.applicantConfirmations || [])
      .filter((item) => item.diagnosisId !== diagnosisId)
    store.applicantConfirmations.push({
      id: `appconf_${diagnosisId}`,
      diagnosisId,
      companyId: company.id,
      userId: scope.userId,
      ...applicantConfirmations,
    })

    const profileForMatching = {
      ...company.profile,
      applicantConfirmations,
    }
    const matches = servicePorts.Matcher.match({
      diagnosisId,
      profile: profileForMatching,
      rounds: servicePorts.SubsidyDataSource.listActiveRounds(),
    }).map((match) => ({ ...match, userId: scope.userId }))
    store.matches = store.matches.filter((item) => item.diagnosisId !== diagnosisId)
    store.matches.push(...matches)
    diagnosis.matchCount = matches.length
    diagnosis.totalLimit = matches.reduce((sum, match) => sum + match.maxLimit, 0)
    diagnosis.updatedAt = nowIso()
    diagnosis.events.push({
      event: 'diagnosis.applicant_confirmations.updated',
      data: {
        diagnosisId,
        confirmedFields: applicantConfirmations.confirmedFields,
        warnings: applicantConfirmations.warnings,
      },
      createdAt: nowIso(),
    })
    updatedResult = { applicantConfirmations, matches }
  })

  await storeRepository.appendAudit('confirmation.updated', {
    confirmationId: updatedResult?.applicantConfirmations?.id || null,
    diagnosisId,
    confirmedFields: updatedResult?.applicantConfirmations?.confirmedFields || [],
    warningCount: updatedResult?.applicantConfirmations?.warnings?.length || 0,
  }, scope)

  const result = await getMatches(diagnosisId, { audit: false })
  return {
    ...result,
    applicantConfirmations: updatedResult?.applicantConfirmations || result?.applicantConfirmations || null,
  }
}

function normalizeApplicantConfirmations(rawAnswers, { previous = null, diagnosis, company, profile }) {
  const answers = {
    prefecture: stringOrUnknown(rawAnswers.prefecture),
    city: stringOrUnknown(rawAnswers.city),
    employeeCount: finiteNumberOrNull(rawAnswers.employeeCount),
    capitalYen: finiteNumberOrNull(rawAnswers.capitalYen),
    businessType: enumOrUnknown(rawAnswers.businessType, ['sole_proprietor', 'small_business', 'sme', 'nonprofit', 'large_company']),
    plannedInvestmentYen: finiteNumberOrNull(rawAnswers.plannedInvestmentYen),
    estimateStatus: enumOrUnknown(rawAnswers.estimateStatus, ['obtained', 'requested', 'not_started', 'not_required']),
    gBizIDReadiness: enumOrUnknown(rawAnswers.gBizIDReadiness, ['ready', 'applying', 'not_started']),
    targetTiming: enumOrUnknown(rawAnswers.targetTiming, ['within_30_days', 'within_3_months', 'after_3_months', 'undecided']),
  }
  const warnings = []
  if (profile.prefecture && answers.prefecture !== 'unknown' && profile.prefecture !== answers.prefecture) {
    warnings.push(`公開サイトの都道府県「${profile.prefecture}」と申請者回答「${answers.prefecture}」が異なります。`)
  }
  if (profile.city && answers.city !== 'unknown' && profile.city !== answers.city) {
    warnings.push(`公開サイトの市区町村「${profile.city}」と申請者回答「${answers.city}」が異なります。`)
  }
  for (const field of ['employeeCount', 'capitalYen', 'plannedInvestmentYen']) {
    if (rawAnswers[field] !== undefined && rawAnswers[field] !== '' && answers[field] === null) {
      warnings.push(`${applicantFieldLabel(field)}は数値で入力してください。`)
    }
  }
  if (answers.employeeCount !== null && answers.employeeCount < 0) {
    warnings.push('従業員数が負の値です。入力内容を確認してください。')
  }
  if (answers.capitalYen !== null && answers.capitalYen < 0) {
    warnings.push('資本金が負の値です。入力内容を確認してください。')
  }

  const confirmedFields = APPLICANT_CONFIRMATION_FIELDS.filter((field) => {
    const value = answers[field]
    return value !== null && value !== undefined && value !== '' && value !== 'unknown'
  })
  const updatedAt = nowIso()
  return {
    id: previous?.id || id('apconf'),
    diagnosisId: diagnosis.id,
    companyId: company.id,
    userId: diagnosis.userId || seedUser.id,
    schemaVersion: 'applicant-confirmations.v1',
    source: 'applicant_questionnaire',
    answers,
    confirmedFields,
    warnings,
    context: {
      diagnosisId: diagnosis.id,
      companyId: company.id,
      inputUrl: diagnosis.inputUrl,
      publicEvidence: {
        name: profile.name,
        prefecture: profile.prefecture,
        city: profile.city,
        keywords: profile.keywords || [],
        unknowns: profile.unknowns || [],
        citations: profile.citations || [],
        extractedAt: profile.extractedAt || null,
      },
    },
    createdAt: previous?.createdAt || updatedAt,
    updatedAt,
  }
}

function summarizeHardRuleStatuses(matches) {
  return matches.reduce((counts, match) => {
    const status = match.hardRuleStatus || match.hardRule?.status || 'needs_confirmation'
    counts[status] = (counts[status] || 0) + 1
    return counts
  }, { eligible: 0, needs_confirmation: 0, mismatch: 0 })
}

export async function recommendExperts({ diagnosisId, roundId, limit = 4 }) {
  const scope = currentAccessScope()
  const [store, experts] = await Promise.all([
    storeRepository.loadUserSnapshot(scope),
    loadExpertPartners(),
  ])
  const diagnosis = diagnosisId ? store.diagnoses.find((item) => item.id === diagnosisId) : null
  if (diagnosisId && !diagnosis) throw accessDeniedAsNotFoundError('diagnosis')
  const company = store.companies.find((item) => item.id === diagnosis?.companyId) || store.companies.at(-1)
  const profile = company?.profile || null
  const round = roundId ? getRound(roundId) : null
  const scoredExperts = experts
    .map((expert) => scoreExpert(expert, profile, round))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'ja'))

  const strongRecommendations = scoredExperts.filter((item) => item.score >= 7)
  const recommendations = ensureMinimumExpertRecommendations(strongRecommendations, scoredExperts, {
    minimum: Math.min(3, limit),
    limit,
    round,
  })

  await storeRepository.appendAudit('expert_recommendations.viewed', {
    diagnosisId: diagnosisId || null,
    roundId: roundId || null,
    count: recommendations.length,
  }, scope)

  return {
    diagnosisId: diagnosisId || null,
    roundId: roundId || null,
    company: profile
      ? {
          id: company.id,
          name: profile.name,
          keywords: profile.keywords,
        }
      : null,
    disclaimer:
      '候補専門家の提示です。報酬、対応範囲、受任可否は各専門家に直接確認してください。',
    recommendations,
  }
}

function ensureMinimumExpertRecommendations(strongRecommendations, scoredExperts, { minimum = 3, limit = 4, round = null } = {}) {
  const selected = strongRecommendations.slice(0, limit)
  if (selected.length >= minimum) return selected

  const selectedIds = new Set(selected.map((item) => item.id))
  const fallbacks = scoredExperts
    .filter((item) => !selectedIds.has(item.id))
    .filter((item) => item.sourceUrl && item.caveats?.length >= 2)
    .slice(0, Math.max(0, minimum - selected.length))
    .map((item) => ({
      ...item,
      fitLevel: 'candidate',
      fallbackCandidate: true,
      reasons: [
        round
          ? `${round.program.name}の重点対応は未確認のため、初回相談で対応可否を確認してください。`
          : '制度別の重点対応は未確認のため、初回相談で対応可否を確認してください。',
        ...item.reasons,
      ].slice(0, 4),
    }))

  return [...selected, ...fallbacks].slice(0, limit)
}

async function loadExpertPartners() {
  const raw = await fs.readFile(expertPartnersPath, 'utf8')
  return JSON.parse(raw)
}

function scoreExpert(expert, profile, round) {
  const companyKeywords = new Set(profile?.keywords || [])
  const programFit = round && expert.programFocus?.includes(round.roundId) ? 4 : round ? 1.6 : 2.6
  const keywordOverlap = (expert.strengthKeywords || []).filter((keyword) => (
    companyKeywords.has(keyword) ||
    profile?.businessSummary?.includes(keyword) ||
    round?.keywords?.includes(keyword)
  ))
  const keywordFit = Math.min(2, keywordOverlap.length * 0.5)
  const accessFit = Math.min(1.5, (expert.consultationMode?.includes('online') ? 0.9 : 0.4) + (expert.serviceArea?.includes('全国') ? 0.6 : 0.3))
  const sourceFit = expert.verificationLevel === 'official_site' && expert.sourceUrl ? 1.5 : 0.6
  const complianceFit = expert.caveats?.length >= 2 ? 1 : 0.5
  const score = round1(Math.min(10, programFit + keywordFit + accessFit + sourceFit + complianceFit))
  return {
    id: expert.id,
    name: expert.name,
    category: expert.category,
    serviceArea: expert.serviceArea,
    locations: expert.locations,
    websiteUrl: expert.websiteUrl,
    sourceUrl: expert.sourceUrl,
    score,
    fitLevel: score >= 8.5 ? 'strong' : score >= 7.8 ? 'good' : 'candidate',
    matchedKeywords: keywordOverlap.slice(0, 5),
    reasons: buildExpertReasons(expert, round, keywordOverlap),
    fitNotes: expert.fitNotes,
    caveats: expert.caveats,
    lastSeenAt: expert.lastSeenAt,
  }
}

function buildExpertReasons(expert, round, keywordOverlap) {
  const reasons = []
  if (round && expert.programFocus?.includes(round.roundId)) {
    reasons.push(`${round.program.name}を重点領域として扱える候補です。`)
  }
  if (keywordOverlap.length > 0) {
    reasons.push(`会社情報・制度情報と「${keywordOverlap.slice(0, 3).join('」「')}」が重なります。`)
  }
  if (expert.consultationMode?.includes('online')) {
    reasons.push('オンライン相談に対応する候補として確認できます。')
  }
  reasons.push('公式サイトで公開情報を確認した候補です。')
  return reasons.slice(0, 4)
}

export function getRound(roundId) {
  const round = servicePorts.SubsidyDataSource.getRound(roundId)
  if (!round) return null
  return {
    ...round,
    daysLeft: daysLeft(round.acceptEnd),
  }
}

export async function createBusinessPlan({ companyId, roundId, targetChars = 4200 }) {
  const scope = currentAccessScope()
  const store = await storeRepository.loadUserSnapshot(scope)
  const company = companyId
    ? store.companies.find((item) => item.id === companyId)
    : store.companies.at(-1)
  const round = getRound(roundId)
  if (!company || !round) {
    throw Object.assign(new Error('対象データが見つかりません'), { status: 404, code: 'NOT_FOUND' })
  }
  const planId = id('plan')
  const template = buildPlanTemplateMetadata(round)
  const sourceReferences = buildPlanSourceReferences(company.profile, round)
  const requiredDocumentChecklist = buildRequiredDocumentChecklist(round)
  const confirmationFlags = buildPlanConfirmationFlags(company.profile, round, template)
  const generation = buildPlanGenerationProvenance(template)
  const plan = {
    id: planId,
    userId: scope.userId,
    companyId: company.id,
    roundId,
    status: 'generating',
    targetChars,
    template,
    sourceReferences,
    requiredDocumentChecklist,
    confirmationFlags,
    generation,
    sections: [],
    createdAt: nowIso(),
    updatedAt: nowIso(),
    events: [{
      event: 'plan.generation.queued',
      data: { planId, status: 'generating', generation },
      createdAt: nowIso(),
    }],
    exports: [],
  }

  await storeRepository.mutate((draft) => {
    draft.plans.push(plan)
  })

  runPlanGeneration(planId).catch((error) => markPlanFailed(planId, error))
  await storeRepository.appendAudit('business_plan.started', { planId, roundId, generation }, scope)
  return { planId, status: 'generating' }
}

function buildPlanTemplateMetadata(round, sections = []) {
  const selected = selectPlanTemplate(round)
  const fromSection = sections.find((section) => section.templateId || section.templateName)
  if (fromSection?.templateId === selected.id) return selected
  if (fromSection) {
    return {
      id: fromSection.templateId || 'custom-template',
      category: fromSection.templateCategory || 'custom',
      name: fromSection.templateName || 'カスタム下書きテンプレート',
      version: fromSection.templateVersion || 'custom',
    }
  }
  return selected
}

async function createPlanSectionsWithFallback({ profile, round, targetChars, planId, companyId, diagnosisId }) {
  try {
    const result = await servicePorts.PlanGenerator.createSections({ profile, round, targetChars, planId, companyId, diagnosisId })
    if (!Array.isArray(result)) {
      throw Object.assign(new TypeError('PlanGenerator.createSections must return an array'), {
        code: 'PLAN_GENERATOR_INVALID_OUTPUT',
      })
    }
    return {
      sections: [...result],
      generationOverride: result.generation || null,
    }
  } catch (error) {
    const provenance = typeof servicePorts.PlanGenerator.provenance === 'function'
      ? servicePorts.PlanGenerator.provenance()
      : {}
    if (!shouldFallbackPlanGeneration(error, provenance)) throw error
    const sections = localMockServicePorts.PlanGenerator.createSections({ profile, round, targetChars })
    return {
      sections,
      generationOverride: {
        provider: provenance.provider || 'bedrock',
        mode: 'fallback_to_deterministic_template',
        model: provenance.model || null,
        llm: false,
        adapter: 'PlanGenerator.localMockFallback',
        phase: 'phase2_cost_guard',
        fallback: {
          from: provenance.adapter || 'PlanGenerator.bedrock',
          code: error.code || 'PLAN_GENERATOR_FAILED',
          message: safePlanGenerationFallbackMessage(error),
        },
        ...(provenance.budget ? { budget: provenance.budget } : {}),
      },
    }
  }
}

function shouldFallbackPlanGeneration(error, provenance = {}) {
  return (
    provenance.provider === 'bedrock' ||
    provenance.provider === 'claude_cli' ||
    /^LLM_|^BEDROCK_|^CLAUDE_CLI_/.test(String(error.code || ''))
  )
}

function safePlanGenerationFallbackMessage(error) {
  if (String(error?.code || '').startsWith('CLAUDE_CLI_')) {
    return 'Claude CLI generation failed and local template fallback was used'
  }
  if (String(error?.code || '').startsWith('BEDROCK_')) {
    return 'Bedrock generation failed and local template fallback was used'
  }
  if (String(error?.code || '').startsWith('LLM_')) {
    return 'LLM budget guard rejected the request and local template fallback was used'
  }
  return 'Plan generator failed and local template fallback was used'
}

function buildPlanGenerationProvenance(template = null, generationOverride = null) {
  const templateProvenance = template
    ? {
        templateId: template.id,
        templateCategory: template.category,
        templateName: template.name,
        templateVersion: template.version,
      }
    : {}
  if (generationOverride) {
    return { ...generationOverride, ...templateProvenance }
  }
  if (servicePorts.PlanGenerator.createSections === localMockServicePorts.PlanGenerator.createSections) {
    return { ...LOCAL_PLAN_GENERATION_PROVENANCE, ...templateProvenance }
  }
  const adapterProvenance = typeof servicePorts.PlanGenerator.provenance === 'function'
    ? servicePorts.PlanGenerator.provenance()
    : {}
  return {
    provider: 'custom_adapter',
    mode: 'adapter_unspecified',
    model: null,
    llm: null,
    adapter: 'PlanGenerator.custom',
    phase: 'custom',
    ...templateProvenance,
    ...adapterProvenance,
  }
}

async function markPlanFailed(planId, error) {
  await storeRepository.mutate((draft) => {
    const target = draft.plans.find((item) => item.id === planId)
    if (!target) return
    target.status = 'failed'
    target.error = { code: error.code || 'PLAN_GENERATION_FAILED', message: error.message || '計画書の生成に失敗しました' }
    target.updatedAt = nowIso()
    target.events.push({
      event: 'plan.error',
      data: target.error,
      createdAt: nowIso(),
    })
  })
}

async function runPlanGeneration(planId) {
  const store = await storeRepository.load()
  const plan = store.plans.find((item) => item.id === planId)
  if (!plan) return
  const company = store.companies.find((item) => item.id === plan.companyId)
  const round = getRound(plan.roundId)
  if (!company || !round) {
    throw Object.assign(new Error('対象データが見つかりません'), { status: 404, code: 'NOT_FOUND' })
  }

  await storeRepository.mutate((draft) => {
    const target = draft.plans.find((item) => item.id === planId)
    if (!target) return
    target.events.push({
      event: 'plan.generation.started',
      data: { planId, provider: target.generation?.provider || null, model: target.generation?.model || null },
      createdAt: nowIso(),
    })
  })

  const { sections, generationOverride } = await createPlanSectionsWithFallback({
    profile: company.profile,
    round,
    targetChars: plan.targetChars,
    planId,
    companyId: company.id,
    diagnosisId: company.diagnosisId || null,
  })
  const template = buildPlanTemplateMetadata(round, sections)
  const sourceReferences = buildPlanSourceReferences(company.profile, round)
  const requiredDocumentChecklist = buildRequiredDocumentChecklist(round)
  const confirmationFlags = buildPlanConfirmationFlags(company.profile, round, template)
  const generation = buildPlanGenerationProvenance(template, generationOverride)

  await storeRepository.mutate((draft) => {
    const target = draft.plans.find((item) => item.id === planId)
    if (!target) return
    target.template = template
    target.sourceReferences = sourceReferences
    target.requiredDocumentChecklist = requiredDocumentChecklist
    target.confirmationFlags = confirmationFlags
    target.generation = generation
    target.sections = sections
    target.updatedAt = nowIso()
  })

  for (const section of sections) {
    await delay(120)
    await storeRepository.mutate((draft) => {
      const target = draft.plans.find((item) => item.id === planId)
      if (!target) return
      target.events.push({
        event: 'plan.section.started',
        data: { chapterNo: section.chapterNo, heading: section.heading },
        createdAt: nowIso(),
      })
      target.events.push({
        event: 'plan.section.delta',
        data: { chapterNo: section.chapterNo, delta: section.body },
        createdAt: nowIso(),
      })
      target.events.push({
        event: 'plan.section.completed',
        data: { chapterNo: section.chapterNo, status: section.status, charCount: section.charCount },
        createdAt: nowIso(),
      })
    })
  }
  await storeRepository.mutate((draft) => {
    const target = draft.plans.find((item) => item.id === planId)
    if (!target) return
    target.status = 'draft'
    target.updatedAt = nowIso()
    target.events.push({
      event: 'plan.completed',
      data: { planId, status: 'draft', generation: target.generation || null },
      createdAt: nowIso(),
    })
  })
  await storeRepository.appendAudit('business_plan.completed', { planId, generation }, plan.userId)
}

export async function getPlan(planId) {
  const bundle = await storeRepository.getPlanBundleForUser(currentAccessScope(), planId)
  return bundle?.plan || null
}

export async function getPlanEvents(planId) {
  const plan = await getPlan(planId)
  return plan?.events || []
}

export async function patchPlanSection(planId, chapterNo, body, status = 'edited') {
  const scope = currentAccessScope()
  const result = await storeRepository.mutate((store) => {
    const plan = findOwned(store.plans, scope, (item) => item.id === planId)
    if (!plan) throw accessDeniedAsNotFoundError('plan')
    const section = plan.sections.find((item) => item.chapterNo === Number(chapterNo))
    if (!section) throw Object.assign(new Error('章が見つかりません'), { status: 404, code: 'NOT_FOUND' })
    section.body = String(body || '')
    section.status = status
    section.revision += 1
    section.charCount = section.body.length
    section.updatedAt = nowIso()
    plan.status = 'edited'
    plan.updatedAt = nowIso()
    return {
      chapterNo: section.chapterNo,
      status: section.status,
      revision: section.revision,
      updatedAt: section.updatedAt,
    }
  })
  await storeRepository.appendAudit('business_plan.section_edited', {
    planId,
    chapterNo: Number(chapterNo),
    revision: result.revision,
    status: result.status,
  }, scope)
  return result
}

export async function confirmBusinessPlanDraft(planId, payload = {}) {
  const scope = currentAccessScope()
  const confirmed = normalizeDraftConfirmation(payload)
  let confirmation = null
  await storeRepository.mutate((store) => {
    const plan = findOwned(store.plans, scope, (item) => item.id === planId)
    if (!plan) throw accessDeniedAsNotFoundError('plan')
    if (!['draft', 'edited', 'exported'].includes(plan.status)) {
      throw Object.assign(new Error('下書き作成後に確認してください'), { status: 409, code: 'PLAN_NOT_READY' })
    }
    confirmation = {
      id: `appconf_${planId}_draft_review`,
      type: 'business_plan_draft_review',
      planId,
      companyId: plan.companyId,
      roundId: plan.roundId,
      userId: scope.userId,
      organizationId: scope.organizationId || null,
      status: 'confirmed',
      confirmedFields: ['draftResponsibility', 'sourceReview', 'noDelegatedFiling'],
      answers: confirmed,
      context: {
        planId,
        companyId: plan.companyId,
        roundId: plan.roundId,
        sectionCount: plan.sections?.length || 0,
      },
      createdAt: nowIso(),
      updatedAt: nowIso(),
    }
    store.applicantConfirmations = (store.applicantConfirmations || [])
      .filter((item) => item.id !== confirmation.id)
    store.applicantConfirmations.push(confirmation)
    plan.applicantDraftConfirmation = confirmation
    plan.updatedAt = nowIso()
    plan.events.push({
      event: 'plan.confirmation.updated',
      data: {
        planId,
        confirmationId: confirmation.id,
        confirmedFields: confirmation.confirmedFields,
      },
      createdAt: nowIso(),
    })
  })
  await storeRepository.appendAudit('confirmation.updated', {
    confirmationId: confirmation.id,
    planId,
    roundId: confirmation.roundId,
    confirmedFields: confirmation.confirmedFields,
    confirmationType: confirmation.type,
  }, scope)
  return confirmation
}

function normalizeDraftConfirmation(payload = {}) {
  const confirmation = {
    draftResponsibility: payload.draftResponsibility === true,
    sourceReview: payload.sourceReview === true,
    noDelegatedFiling: payload.noDelegatedFiling === true,
  }
  const missing = Object.entries(confirmation)
    .filter(([, value]) => value !== true)
    .map(([key]) => key)
  if (missing.length > 0) {
    throw Object.assign(new Error('出力前に下書きの本人確認事項を確認してください'), {
      status: 422,
      code: 'DRAFT_CONFIRMATION_REQUIRED',
      details: { missing },
    })
  }
  return confirmation
}

export async function exportPlan(planId, format) {
  const scope = currentAccessScope()
  const bundle = await storeRepository.getPlanBundleForUser(scope, planId)
  const plan = bundle?.plan
  if (!plan) throw accessDeniedAsNotFoundError('plan')
  if (!['draft', 'edited', 'exported'].includes(plan.status)) {
    throw Object.assign(new Error('下書き作成後に出力してください'), { status: 409, code: 'PLAN_NOT_READY' })
  }
  if (plan.applicantDraftConfirmation?.status !== 'confirmed') {
    throw Object.assign(new Error('出力前に下書きの本人確認事項を確認してください'), {
      status: 409,
      code: 'DRAFT_CONFIRMATION_REQUIRED',
    })
  }
  if (!['docx', 'pdf'].includes(format)) throw validationError('出力形式を確認してください')
  const round = getRound(plan.roundId)
  const company = bundle.company
  const storageKey = `${planId}.${format}`
  const body = format === 'pdf'
    ? makePdf(plan, company, round)
    : makeDocx(plan, company, round)
  const stored = await objectStoragePort.putObject({
    key: storageKey,
    body,
    contentType: mimeTypeForExport(format),
    metadata: {
      planId,
      userId: scope.userId,
      format,
      disclaimerIncluded: true,
    },
  })
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString()
  const exportRecord = {
    id: id('export'),
    format,
    storageKey: stored.key,
    filename: stored.key,
    mimeType: stored.contentType,
    sizeBytes: stored.sizeBytes,
    checksum: stored.checksum,
    fileUrl: objectStoragePort.signGetUrl({ key: stored.key, userId: scope.userId, expiresAt }),
    expiresAt,
    disclaimerIncluded: true,
    storageProvider: 'local',
    createdAt: nowIso(),
  }
  await storeRepository.mutate((draft) => {
    const target = findOwned(draft.plans, scope, (item) => item.id === planId)
    if (!target) throw accessDeniedAsNotFoundError('plan')
    target.status = 'exported'
    target.exports.push(exportRecord)
  })
  await storeRepository.appendAudit('business_plan.exported', {
    exportId: exportRecord.id,
    planId,
    format,
    fileName: exportRecord.filename,
    filename: exportRecord.filename,
    storageKey: exportRecord.storageKey,
    sizeBytes: exportRecord.sizeBytes,
    disclaimerIncluded: exportRecord.disclaimerIncluded,
  }, scope)
  return exportRecord
}

export async function getExportRecord(filename) {
  return storeRepository.getExportRecordForUser(currentAccessScope(), filename)
}

export async function readExportDownload(filename, token) {
  const scope = currentAccessScope()
  const record = await storeRepository.getExportRecordForUser(scope, filename)
  if (!record || new Date(record.expiresAt).getTime() < Date.now()) {
    throw accessDeniedAsNotFoundError('export')
  }
  const storageKey = record.storageKey || record.filename || filename
  if (!objectStoragePort.verifySignedUrl({ key: storageKey, userId: scope.userId, token })) {
    throw accessDeniedAsNotFoundError('export')
  }
  const object = await objectStoragePort.getObject({ key: storageKey })
  await storeRepository.appendAudit('file.downloaded', {
    exportId: record.id || null,
    planId: record.planId,
    filename: record.filename || storageKey,
    storageKey,
    format: record.format,
    sizeBytes: record.sizeBytes || object.sizeBytes,
  }, scope)
  return {
    body: object.body,
    contentType: record.mimeType || object.contentType || mimeTypeForExport(record.format),
    sizeBytes: object.sizeBytes,
  }
}

function mimeTypeForExport(format) {
  return format === 'pdf'
    ? 'application/pdf'
    : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
}

function planText(plan, company, round) {
  const template = plan.template || selectPlanTemplate(round)
  const requiredDocuments = plan.requiredDocumentChecklist || buildRequiredDocumentChecklist(round)
  const sourceReferences = plan.sourceReferences || buildPlanSourceReferences(company?.profile, round)
  const confirmationFlags = plan.confirmationFlags || buildPlanConfirmationFlags(company?.profile, round, template)
  return [
    '事業計画書 下書き',
    `制度名: ${round?.program.name || plan.roundId}`,
    `会社名: ${company?.profile?.name || company?.name || '未確認'}`,
    `テンプレート: ${template?.name || '未確認'}`,
    `本人確認項目: ${confirmationFlags.join('、') || '要確認'}`,
    `必要書類: ${requiredDocuments.map((item) => item.label).join('、') || '公式ページで確認'}`,
    '出典:',
    ...sourceReferences.map((source) => `- ${source.label}: ${source.url}${source.lastSeenAt ? ` (${formatDate(source.lastSeenAt)})` : ''}`),
    '',
    ...plan.sections.flatMap((section) => [
      `${section.chapterNo}. ${section.heading}`,
      `状態: ${section.needsConfirmation ? '本人確認が必要' : 'AI下書き'}`,
      section.requiredDocumentRefs?.length ? `関連書類: ${section.requiredDocumentRefs.join('、')}` : null,
      section.confirmationFlags?.length ? `章の確認項目: ${section.confirmationFlags.join('、')}` : null,
      ...(section.sources?.length ? ['章の出典:', ...section.sources.map((source) => `- ${source.label}: ${source.url}`)] : []),
      section.body,
      '',
    ].filter(Boolean)),
    DISCLAIMER,
  ].join('\n')
}

function makePdf(plan, company, round) {
  const linesPerPage = 52
  const lines = planText(plan, company, round)
    .split('\n')
    .flatMap((line) => wrapText(line, 44))
  const pages = chunk(lines.length > 0 ? lines : [' '], linesPerPage)
  const pageObjects = pages.map((pageLines, index) => ({
    pageId: 3 + index * 2,
    contentId: 4 + index * 2,
    lines: pageLines,
  }))
  const fontId = 3 + pages.length * 2
  const descendantFontId = fontId + 1
  const pageKids = pageObjects.map((page) => `${page.pageId} 0 R`).join(' ')
  const objects = [
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
    `2 0 obj << /Type /Pages /Kids [${pageKids}] /Count ${pages.length} >> endobj`,
    ...pageObjects.flatMap((page) => {
      const stream = [
        'BT',
        '/F1 10 Tf',
        '50 790 Td',
        '14 TL',
        ...page.lines.map((line) => `<${utf16BeHex(line || ' ')}> Tj T*`),
        'ET',
      ].join('\n')
      return [
        `${page.pageId} 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${page.contentId} 0 R >> endobj`,
        `${page.contentId} 0 obj << /Length ${Buffer.byteLength(stream)} >> stream\n${stream}\nendstream endobj`,
      ]
    }),
    `${fontId} 0 obj << /Type /Font /Subtype /Type0 /BaseFont /HeiseiKakuGo-W5 /Encoding /UniJIS-UCS2-H /DescendantFonts [${descendantFontId} 0 R] >> endobj`,
    `${descendantFontId} 0 obj << /Type /Font /Subtype /CIDFontType0 /BaseFont /HeiseiKakuGo-W5 /CIDSystemInfo << /Registry (Adobe) /Ordering (Japan1) /Supplement 6 >> /FontDescriptor << /Type /FontDescriptor /FontName /HeiseiKakuGo-W5 /Flags 4 /FontBBox [0 -200 1000 900] /ItalicAngle 0 /Ascent 880 /Descent -120 /CapHeight 700 /StemV 80 >> >> endobj`,
  ]
  let pdf = '%PDF-1.4\n'
  const offsets = [0]
  for (const object of objects) {
    offsets.push(Buffer.byteLength(pdf))
    pdf += `${object}\n`
  }
  const xref = Buffer.byteLength(pdf)
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (const offset of offsets.slice(1)) {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`
  }
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return Buffer.from(pdf)
}

function chunk(values, size) {
  const chunks = []
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size))
  }
  return chunks
}

function wrapText(value, width) {
  const text = String(value || '')
  if (text.length <= width) return [text]
  const lines = []
  for (let index = 0; index < text.length; index += width) {
    lines.push(text.slice(index, index + width))
  }
  return lines
}

function utf16BeHex(value) {
  const buffer = Buffer.from(String(value), 'utf16le')
  for (let index = 0; index < buffer.length; index += 2) {
    const first = buffer[index]
    buffer[index] = buffer[index + 1]
    buffer[index + 1] = first
  }
  return buffer.toString('hex').toUpperCase()
}

function makeDocx(plan, company, round) {
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>
${planText(plan, company, round)
  .split('\n')
  .map((line) => `<w:p><w:r><w:t>${escapeXml(line)}</w:t></w:r></w:p>`)
  .join('')}
</w:body></w:document>`
  const files = {
    '[Content_Types].xml':
      '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
    '_rels/.rels':
      '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
    'word/document.xml': documentXml,
  }
  return zipStore(files)
}

function escapeXml(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function zipStore(files) {
  const localParts = []
  const centralParts = []
  let offset = 0
  for (const [name, content] of Object.entries(files)) {
    const nameBuffer = Buffer.from(name)
    const body = Buffer.from(content)
    const crc = crc32(body)
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(0, 6)
    local.writeUInt16LE(0, 8)
    local.writeUInt16LE(0, 10)
    local.writeUInt16LE(0, 12)
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(body.length, 18)
    local.writeUInt32LE(body.length, 22)
    local.writeUInt16LE(nameBuffer.length, 26)
    local.writeUInt16LE(0, 28)
    localParts.push(local, nameBuffer, body)

    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE(20, 4)
    central.writeUInt16LE(20, 6)
    central.writeUInt16LE(0, 8)
    central.writeUInt16LE(0, 10)
    central.writeUInt16LE(0, 12)
    central.writeUInt16LE(0, 14)
    central.writeUInt32LE(crc, 16)
    central.writeUInt32LE(body.length, 20)
    central.writeUInt32LE(body.length, 24)
    central.writeUInt16LE(nameBuffer.length, 28)
    central.writeUInt16LE(0, 30)
    central.writeUInt16LE(0, 32)
    central.writeUInt16LE(0, 34)
    central.writeUInt16LE(0, 36)
    central.writeUInt32LE(0, 38)
    central.writeUInt32LE(offset, 42)
    centralParts.push(central, nameBuffer)
    offset += local.length + nameBuffer.length + body.length
  }
  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(0, 4)
  end.writeUInt16LE(0, 6)
  end.writeUInt16LE(Object.keys(files).length, 8)
  end.writeUInt16LE(Object.keys(files).length, 10)
  end.writeUInt32LE(centralSize, 12)
  end.writeUInt32LE(offset, 16)
  end.writeUInt16LE(0, 20)
  return Buffer.concat([...localParts, ...centralParts, end])
}

function crc32(buffer) {
  let crc = 0xffffffff
  for (const byte of buffer) {
    crc ^= byte
    for (let i = 0; i < 8; i += 1) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}

export async function createLead(payload) {
  return servicePorts.Notifier.createExpertWaitlistLead(payload)
}

async function localMockCreateExpertWaitlistLead(payload) {
  const scope = currentAccessScope()
  let leadRecord = null
  const result = await storeRepository.mutate((store) => {
    if (payload.diagnosisId && !findOwned(store.diagnoses, scope, (item) => item.id === payload.diagnosisId)) {
      throw accessDeniedAsNotFoundError('diagnosis')
    }
    leadRecord = {
      id: id('lead'),
      userId: scope.userId,
      diagnosisId: payload.diagnosisId || null,
      roundId: payload.roundId || null,
      expertId: payload.expertId || null,
      message: payload.message || '専門家相談が始まったら知らせてください',
      status: 'waitlisted',
      createdAt: nowIso(),
    }
    store.leads.push(leadRecord)
    return { ok: true, status: 'waitlisted', leadId: leadRecord.id }
  })
  await storeRepository.appendAudit('expert_waitlist.submitted', {
    leadId: leadRecord.id,
    diagnosisId: leadRecord.diagnosisId,
    roundId: leadRecord.roundId,
    expertId: leadRecord.expertId,
    status: leadRecord.status,
  }, scope)
  return result
}

export async function updateNotificationSettings(settings) {
  return servicePorts.Notifier.updateSettings(settings)
}

async function localMockUpdateNotificationSettings(settings) {
  const scope = currentAccessScope()
  const result = await storeRepository.mutate((store) => {
    store.notificationSettings = {
      ...store.notificationSettings,
      ...settings,
    }
    return store.notificationSettings
  })
  await storeRepository.appendAudit('notification.setting_changed', result, scope)
  return result
}

export async function submitBusinessPlan(planId, payload = {}) {
  const plan = await getPlan(planId)
  if (!plan) throw accessDeniedAsNotFoundError('plan')
  return servicePorts.SubmissionAdapter.submit({ plan, payload })
}

async function localMockSubmitBlocked({ plan, payload }) {
  const scope = currentAccessScope()
  await storeRepository.appendAudit('submission.blocked', {
    planId: plan.id,
    roundId: plan.roundId,
    requestedMode: payload?.mode || null,
    reason: 'notConfigured',
  }, scope)
  return {
    ok: false,
    status: 'blocked',
    reason: 'notConfigured',
    code: 'SUBMISSION_NOT_CONFIGURED',
    message: '公式申請の送信機能は未設定です。現時点では下書き確認と書類出力のみ利用できます。',
  }
}

export async function listUserData() {
  const user = authUser()
  const store = await storeRepository.loadUserSnapshot(user)
  return {
    user,
    companies: store.companies,
    diagnoses: store.diagnoses,
    applicantConfirmations: store.applicantConfirmations || [],
    plans: store.plans,
    leads: store.leads,
    notificationSettings: store.notificationSettings,
    auditLogs: store.auditLogs,
  }
}

export async function analytics() {
  const store = await storeRepository.loadUserSnapshot(currentAccessScope())
  const counts = {}
  for (const log of store.auditLogs) {
    counts[log.event] = (counts[log.event] || 0) + 1
  }
  return {
    eventCounts: counts,
    diagnosisCount: store.diagnoses.length,
    planCount: store.plans.length,
    exportCount: store.plans.reduce((sum, plan) => sum + plan.exports.length, 0),
    waitlistCount: store.leads.length,
    events: store.auditLogs.slice(-100),
  }
}

function formatDate(value) {
  if (!value) return '未確認'
  return new Intl.DateTimeFormat('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value))
}

function stringOrUnknown(value) {
  const normalized = String(value || '').trim()
  return normalized || 'unknown'
}

function enumOrUnknown(value, allowed) {
  const normalized = String(value || '').trim()
  return allowed.includes(normalized) ? normalized : 'unknown'
}

function finiteNumberOrNull(value) {
  if (value === null || value === undefined || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function round1(value) {
  return Math.round(value * 10) / 10
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
