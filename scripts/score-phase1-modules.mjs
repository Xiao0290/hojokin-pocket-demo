#!/usr/bin/env node
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const THRESHOLD = 8.5

export const REQUIRED_MODULES = [
  {
    id: 'F01',
    name: 'Login',
    required: 'Email / Google / LINE entry points and local mock auth.',
    items: [
      check('mock auth service and route exist', 2, ['server/services.mjs', 'server/index.mjs'], (ctx) =>
        hasAll(ctx.files.services, ['export async function devLogin', "appendAudit('auth.login'"]) &&
        hasAll(ctx.files.index, ["pathname === '/v1/auth/dev-login'", 'await devLogin()'])),
      check('local user and token response exist', 2, ['server/seedData.mjs', 'server/services.mjs'], (ctx) =>
        hasAll(ctx.files.seedData, ['seedUser', 'displayName']) &&
        hasAll(ctx.files.services, ['dev-token', 'user: seedUser'])),
      check('login UI exposes dev, email, Google, and LINE entry points', 2, ['src/App.jsx'], (ctx) =>
        hasAll(ctx.files.app, ['開発用ログイン', 'メールで始める', 'Googleで続ける', 'LINEで続ける'])),
      check('login action is audit logged', 1.5, ['server/services.mjs'], (ctx) =>
        hasAll(ctx.files.services, ['appendAudit', 'auth.login'])),
      check('E2E verifies dev login', 2.5, ['scripts/e2e-phase1-mvp.mjs'], (ctx) =>
        hasAll(ctx.files.e2e, ['dev-login', 'E2E_TOKEN', 'accessToken'])),
    ],
  },
  {
    id: 'F02',
    name: 'URL diagnosis',
    required: 'Company URL intake, diagnosis job, SSE progress, and polling fallback.',
    items: [
      check('URL normalization and unsafe URL guard exist', 2, ['server/utils.mjs'], (ctx) =>
        hasAll(ctx.files.utils, ['normalizeCompanyUrl', 'assertPublicUrl', 'isPrivateIp', 'url.href.length > 2048'])),
      check('diagnosis job stores status, progress, and events', 2, ['server/services.mjs'], (ctx) =>
        hasAll(ctx.files.services, ['createDiagnosis', "status: 'scraping'", 'progress: 5', 'diagnosis.events.push'])),
      check('SSE and polling fallback are wired', 2, ['server/index.mjs', 'src/screens/diagnose.jsx', 'scripts/e2e-phase1-mvp.mjs'], (ctx) =>
        hasAll(ctx.files.index, ['sendSse', '/events']) &&
        hasAll(ctx.files.diagnoseScreen, ['openEvents', '接続を確認しています']) &&
        hasAll(ctx.files.e2e, ['falling back to polling', 'pollJson'])),
      check('local company-site fallback fixture exists', 1.5, ['data/fixtures/company-sites/sample-corp.html', 'server/services.mjs'], (ctx) =>
        ctx.exists.companySiteFixture && hasAll(ctx.files.services, ['readCachedCompanySite', 'sample-corp.html'])),
      check('URL and diagnosis E2E tests exist', 2.5, ['tests/server-utils.test.mjs', 'scripts/e2e-phase1-mvp.mjs'], (ctx) =>
        hasAll(ctx.files.testsUtils, ['normalizeCompanyUrl', 'isPrivateIp', '127.0.0.1']) &&
        hasAll(ctx.files.e2e, ['create-diagnosis', 'wait-diagnosis-done'])),
    ],
  },
  {
    id: 'F03',
    name: 'Company profile',
    required: 'Company name, location hints, business summary, investment direction, citations, and unknowns.',
    items: [
      check('extractor returns name, summary, keywords, unknowns, and citations', 2, ['server/services.mjs'], (ctx) =>
        hasAll(ctx.files.services, ['profileFromHtml', 'businessSummary', 'keywords', 'unknowns', 'citations'])),
      check('official-site-based company fixture exists', 2, ['data/fixtures/company-profiles/sample-corp.json'], (ctx) =>
        hasAllJson(ctx.fixtures.companyProfile, ['businessSummary', 'unknowns', 'citations']) &&
        Array.isArray(ctx.fixtures.companyProfile?.citations) &&
        ctx.fixtures.companyProfile.citations.length >= 2),
      check('diagnosis and matches responses return company profile data', 2, ['server/services.mjs'], (ctx) =>
        hasAll(ctx.files.services, ['getDiagnosis', 'getMatches', 'company.profile.businessSummary', 'company.profile.citations'])),
      check('result UI displays summary, keywords, and unknowns', 1.5, ['src/screens/diagnose.jsx'], (ctx) =>
        hasAll(ctx.files.diagnoseScreen, ['businessSummary', 'keywords', 'unknowns', '要確認'])),
      check('service tests verify company name and citation', 2.5, ['tests/server-services.test.mjs'], (ctx) =>
        hasAll(ctx.files.testsServices, ['株式会社サンプル商会', 'citations', 'sample-corp.example'])),
    ],
  },
  {
    id: 'F04',
    name: 'Subsidy master',
    required: 'Read-only grant master seed, fixture, source URL, last seen date, and traceability.',
    items: [
      check('seed master includes source, last seen date, requirements, and documents', 2.5, ['server/seedData.mjs'], (ctx) =>
        countMatches(ctx.files.seedData, 'roundId:') >= 5 &&
        hasAll(ctx.files.seedData, ['sourceUrl', 'lastSeenAt', 'requirements', 'requiredDocuments'])),
      check('fixture includes hard rules, soft rules, and documents', 2.5, ['data/fixtures/subsidy-programs.json'], (ctx) =>
        Array.isArray(ctx.fixtures.subsidyPrograms?.programs) &&
        ctx.fixtures.subsidyPrograms.programs.length >= 5 &&
        ctx.fixtures.subsidyPrograms.programs.every((program) =>
          Array.isArray(program.hardRules) && program.hardRules.length > 0 &&
          Array.isArray(program.softRules) && program.softRules.length > 0 &&
          Array.isArray(program.requiredDocuments) && program.requiredDocuments.length > 0)),
      check('ingestion and source records provide traceability', 2, ['server/storeRepository.mjs'], (ctx) =>
        hasAll(ctx.files.storeRepository, ['ingestionRuns', 'sourceRecords', 'rawRef', 'fetchedAt'])),
      check('round detail API exists', 1.5, ['server/index.mjs', 'server/services.mjs'], (ctx) =>
        hasAll(ctx.files.index, ['subsidies', 'rounds', 'getRound']) &&
        ctx.files.services.includes('export function getRound')),
      check('E2E verifies detail requirements and documents', 1.5, ['scripts/e2e-phase1-mvp.mjs'], (ctx) =>
        hasAll(ctx.files.e2e, ['get-detail', 'requirements', 'requiredDocuments'])),
    ],
  },
  {
    id: 'F05',
    name: 'Matching engine',
    required: 'Keyword rough screening, hard rule filtering, soft score ranking, and eligible results.',
    items: [
      check('company keywords are compared with program keywords', 2, ['server/services.mjs'], (ctx) =>
        hasAll(ctx.files.services, ['buildMatches', 'profileWords', 'overlap', 'round.keywords'])),
      check('hard requirement data and eligible filtering exist', 2, ['server/seedData.mjs', 'server/services.mjs'], (ctx) =>
        hasAll(ctx.files.seedData, ["kind: 'hard'", "result: 'needs_confirmation'"]) &&
        hasAll(ctx.files.services, ['eligible:', 'item.eligible'])),
      check('soft score ranks and caps the result set', 2, ['server/services.mjs'], (ctx) =>
        hasAll(ctx.files.services, ['matchScore', '.sort((a, b) => b.matchScore - a.matchScore)', '.slice(0, 5)'])),
      check('match response includes reasons, warnings, and deadline days', 1.5, ['server/services.mjs'], (ctx) =>
        hasAll(ctx.files.services, ['reasons: buildReasons', 'warnings:', 'daysLeft'])),
      check('tests verify candidate count and no blocked rows', 2.5, ['tests/server-services.test.mjs', 'scripts/e2e-phase1-mvp.mjs'], (ctx) =>
        hasAll(ctx.files.testsServices, ['matches.length >= 3']) &&
        hasAll(ctx.files.e2e, ['eligible=false', 'matches.length > 0'])),
    ],
  },
  {
    id: 'F06',
    name: 'Diagnosis result list',
    required: 'Three to five candidates with amount, rate, deadline, fit reason, warning, and source context.',
    items: [
      check('matches API returns summary', 2, ['server/services.mjs', 'server/index.mjs'], (ctx) =>
        hasAll(ctx.files.services, ['getMatches', 'summary:', 'matchCount', 'totalLimit']) &&
        ctx.files.index.includes('/matches')),
      check('result set is capped to the Phase 1 range', 2, ['server/services.mjs', 'tests/server-services.test.mjs'], (ctx) =>
        ctx.files.services.includes('.slice(0, 5)') && ctx.files.testsServices.includes('matches.length >= 3')),
      check('result UI displays amount, rate, days, reason, and warning', 2, ['src/screens/diagnose.jsx'], (ctx) =>
        hasAll(ctx.files.diagnoseScreen, ['上限', '補助率', '残', 'reason-line', 'warning-text'])),
      check('empty and error states exist', 1, ['src/screens/diagnose.jsx'], (ctx) =>
        hasAll(ctx.files.diagnoseScreen, ['EmptyState', 'error-box'])),
      check('automated tests cover the list path', 3, ['tests/server-services.test.mjs', 'scripts/e2e-phase1-mvp.mjs'], (ctx) =>
        hasAll(ctx.files.testsServices, ['getMatches', 'matches.length']) &&
        hasAll(ctx.files.e2e, ['get-matches', 'first roundId'])),
    ],
  },
  {
    id: 'F07',
    name: 'Subsidy detail',
    required: 'Requirements, documents, checklist steps, source, last seen date, and official-site handoff.',
    items: [
      check('detail API returns round data', 2, ['server/index.mjs', 'server/services.mjs'], (ctx) =>
        hasAll(ctx.files.index, ['subsidies', 'rounds', 'sendJson(res, 200, round)']) &&
        ctx.files.services.includes('export function getRound')),
      check('detail data includes requirements, documents, steps, source, and last seen date', 2, ['server/seedData.mjs'], (ctx) =>
        hasAll(ctx.files.seedData, ['requirements', 'requiredDocuments', 'steps:', 'sourceUrl', 'lastSeenAt'])),
      check('detail UI displays requirements, documents, and source', 2, ['src/screens/detail.jsx'], (ctx) =>
        hasAll(ctx.files.detailScreen, ['要件', '必要書類', '出典', 'lastSeenAt'])),
      check('filing boundary uses official-site confirmation wording', 1.5, ['server/seedData.mjs', 'scripts/legal-copy-guard.mjs'], (ctx) =>
        ctx.files.seedData.includes('公式サイトで申請手続きを確認') &&
        ctx.files.legalGuard.includes('Phase 1')),
      check('E2E verifies detail response', 2.5, ['scripts/e2e-phase1-mvp.mjs'], (ctx) =>
        hasAll(ctx.files.e2e, ['getSubsidyDetail', 'requirements', 'requiredDocuments'])),
    ],
  },
  {
    id: 'F08',
    name: 'Business plan draft support',
    required: 'Chapter generation, applicant editing, status management, save, and revision.',
    items: [
      check('business plan create API exists', 1.5, ['server/index.mjs', 'server/services.mjs'], (ctx) =>
        hasAll(ctx.files.index, ['/v1/business-plans', 'createBusinessPlan']) &&
        ctx.files.services.includes('export async function createBusinessPlan')),
      check('chapter sections include draft status and sources', 2, ['server/services.mjs', 'server/planTemplates.mjs'], (ctx) =>
        hasAll(ctx.files.services, ['createBusinessPlan', 'sections']) &&
        hasAll(ctx.files.planTemplates, ['buildPlanSections', 'chapterNo', "status: 'ai_draft'", 'sources:', 'needsConfirmation'])),
      check('plan events and polling fallback exist', 1.5, ['server/index.mjs', 'src/screens/detail.jsx', 'scripts/e2e-phase1-mvp.mjs'], (ctx) =>
        hasAll(ctx.files.index, ['getPlanEvents', 'plan.completed']) &&
        hasAll(ctx.files.detailScreen, ['openEvents', '接続を確認しています']) &&
        ctx.files.e2e.includes('plan SSE unavailable')),
      check('chapter editing and save revision exist', 1.5, ['server/services.mjs', 'server/index.mjs'], (ctx) =>
        hasAll(ctx.files.services, ['patchPlanSection', "section.status = status", 'section.revision += 1']) &&
        ctx.files.index.includes('sections')),
      check('plan UI supports streaming, textarea editing, save, and status badges', 1.5, ['src/screens/detail.jsx'], (ctx) =>
        hasAll(ctx.files.detailScreen, ['streamText', 'textarea', 'この章を保存', 'Badge'])),
      check('automated tests cover create, edit, and save', 2, ['tests/server-services.test.mjs', 'scripts/e2e-phase1-mvp.mjs'], (ctx) =>
        hasAll(ctx.files.testsServices, ['createBusinessPlan', 'patchPlanSection', "status, 'edited'"]) &&
        hasAll(ctx.files.e2e, ['create-business-plan', 'patch-business-plan-section'])),
    ],
  },
  {
    id: 'F09',
    name: 'Export',
    required: 'docx and PDF output with disclaimer included.',
    items: [
      check('export API supports docx and PDF', 2, ['server/index.mjs', 'server/services.mjs'], (ctx) =>
        hasAll(ctx.files.index, ['/export', 'exportPlan']) &&
        hasAll(ctx.files.services, ["['docx', 'pdf']", 'exportPlan'])),
      check('local file builders generate both formats', 2, ['server/services.mjs'], (ctx) =>
        hasAll(ctx.files.services, ['makePdf', 'makeDocx', '%PDF-1.4', 'zipStore'])),
      check('disclaimer text and flag are included', 2.5, ['server/seedData.mjs', 'server/services.mjs'], (ctx) =>
        hasAll(ctx.files.seedData, ['DISCLAIMER', '申請者ご本人による下書き作成']) &&
        hasAll(ctx.files.services, ['DISCLAIMER', 'disclaimerIncluded: true'])),
      check('UI exposes docx and PDF actions', 1, ['src/screens/detail.jsx'], (ctx) =>
        hasAll(ctx.files.detailScreen, ["exportFile('docx')", "exportFile('pdf')"])),
      check('automated tests verify format and disclaimer', 2.5, ['tests/server-services.test.mjs', 'scripts/e2e-phase1-mvp.mjs'], (ctx) =>
        hasAll(ctx.files.testsServices, ['disclaimerIncluded', "'PK'", "'%PDF-'"]) &&
        hasAll(ctx.files.e2e, ['export-docx', 'export-pdf', 'disclaimerIncluded'])),
    ],
  },
  {
    id: 'F10',
    name: 'Notifications',
    required: 'Deadline and diagnosis notification settings with local push and email toggles.',
    items: [
      check('notification settings API exists', 2.5, ['server/index.mjs', 'server/services.mjs'], (ctx) =>
        hasAll(ctx.files.index, ['/v1/me/notifications/settings', 'updateNotificationSettings']) &&
        ctx.files.services.includes('export async function updateNotificationSettings')),
      check('default settings exist', 2, ['server/storeRepository.mjs'], (ctx) =>
        hasAll(ctx.files.storeRepository, ['notificationSettings', 'push: true', 'email: true', 'deadline: true'])),
      check('UI saves push, email, and deadline toggles', 2, ['src/screens/home.jsx'], (ctx) =>
        hasAll(ctx.files.homeScreen, ['Push', 'Email', '締切リマインド', 'saveSettings'])),
      check('E2E verifies notification settings', 2, ['scripts/e2e-phase1-mvp.mjs'], (ctx) =>
        hasAll(ctx.files.e2e, ['notification-settings', '/v1/me/notifications/settings'])),
      check('notification audit event exists', 1.5, ['server/services.mjs'], (ctx) =>
        ctx.files.services.includes('notification.setting_changed')),
    ],
  },
  {
    id: 'F11',
    name: 'My page',
    required: 'Diagnosis history, saved plans, company profile edit path, and notification settings.',
    items: [
      check('me and history APIs exist', 2.5, ['server/index.mjs', 'server/services.mjs'], (ctx) =>
        hasAll(ctx.files.index, ['/v1/me', '/v1/me/diagnoses', 'listUserData']) &&
        ctx.files.services.includes('export async function listUserData')),
      check('MyPage displays user, company URL, location, and match count', 2.5, ['src/screens/home.jsx'], (ctx) =>
        hasAll(ctx.files.homeScreen, ['MyPage', '会社URL', '所在地', '確認した候補', 'app.user?.email'])),
      check('user data returns diagnoses, plans, leads, exports, and settings', 2, ['server/services.mjs'], (ctx) =>
        hasAll(ctx.files.services, ['diagnoses: store.diagnoses', 'plans: store.plans', 'leads: store.leads', 'notificationSettings'])),
      check('tab navigation includes preparation and MyPage', 1.5, ['src/App.jsx'], (ctx) =>
        hasAll(ctx.files.app, ["id: 'apply'", "id: 'mypage'", "label: 'マイ'"])),
      check('test plan includes history return verification', 1.5, ['docs/test-plan.md'], (ctx) =>
        hasAll(ctx.files.testPlan, ['マイページ', '診断履歴', '保存済み計画書'])),
    ],
  },
  {
    id: 'F12',
    name: 'Expert recommendations',
    required: 'Official-source expert recommendations plus consultation waitlist; no paid engagement or delegated filing workflow.',
    items: [
      check('official-source expert fixture includes at least five candidates', 2, ['data/fixtures/expert-partners.json', 'docs/expert-sources.md'], (ctx) =>
        Array.isArray(ctx.fixtures.expertPartners) &&
        ctx.fixtures.expertPartners.length >= 5 &&
        ctx.fixtures.expertPartners.every((expert) => expert.sourceUrl?.startsWith('https://') && expert.verificationLevel === 'official_site') &&
        ctx.files.expertSources.includes('日本行政書士会連合会')),
      check('recommendation API and expert scoring exist', 2, ['server/index.mjs', 'server/services.mjs'], (ctx) =>
        hasAll(ctx.files.index, ['/v1/experts/recommendations', 'recommendExperts']) &&
        hasAll(ctx.files.services, ['export async function recommendExperts', 'function scoreExpert', 'fitLevel', 'matchedKeywords'])),
      check('UI displays expert candidates, score, reasons, and expert-specific lead action', 2, ['src/screens/home.jsx', 'src/screens/detail.jsx'], (ctx) =>
        hasAll(ctx.files.detailScreen, ['行政書士候補情報', 'expert.score', 'expert.reasons', 'この候補情報で相談希望を出す']) &&
        hasAll(ctx.files.homeScreen, ['行政書士候補情報', 'expertId'])),
      check('E2E verifies recommendations and expertId waitlist', 2, ['scripts/e2e-phase1-mvp.mjs'], (ctx) =>
        hasAll(ctx.files.e2e, ['get-expert-recommendations', '/v1/experts/recommendations', 'run.expertId', 'expertId: run.expertId'])),
      check('no paid engagement or delegated filing flow is present, and waitlist is audited', 2, ['src', 'server'], (ctx) =>
        !/(stripe|checkout|payment|ekyc|決済|委任|受任確定)/iu.test(ctx.productSource) &&
        ctx.files.services.includes('expert_waitlist.submitted')),
    ],
  },
  {
    id: 'F13',
    name: 'Audit logs',
    required: 'Key activity logging and analytics reporting.',
    items: [
      check('audit log schema and append helper exist', 2, ['server/storeRepository.mjs'], (ctx) =>
        hasAll(ctx.files.storeRepository, ['auditLogs: []', 'async appendAudit', 'createdAt'])),
      check('key events are recorded', 2.5, ['server/services.mjs'], (ctx) =>
        hasAll(ctx.files.services, [
          'diagnosis.completed',
          'business_plan.started',
          'business_plan.section_edited',
          'business_plan.exported',
          'expert_waitlist.submitted',
          'notification.setting_changed',
        ])),
      check('analytics endpoint returns counts and recent events', 2, ['server/index.mjs', 'server/services.mjs'], (ctx) =>
        hasAll(ctx.files.index, ['/v1/analytics', 'analytics()']) &&
        hasAll(ctx.files.services, ['eventCounts', 'events: store.auditLogs.slice(-100)'])),
      check('automated tests verify major KPI events', 2, ['tests/server-services.test.mjs', 'scripts/e2e-phase1-mvp.mjs'], (ctx) =>
        hasAll(ctx.files.testsServices, ['diagnosis.completed', 'business_plan.exported', 'expert_waitlist.submitted', 'notification.setting_changed']) &&
        hasAll(ctx.files.e2e, ['analyticsExpectedEvents', 'verifyAnalytics'])),
      check('source and ingestion trace are retained', 1.5, ['server/storeRepository.mjs'], (ctx) =>
        hasAll(ctx.files.storeRepository, ['ingestionRuns', 'sourceRecords'])),
    ],
  },
]

const FILES = {
  packageJson: 'package.json',
  qualityStandard: 'docs/quality-standard.md',
  testPlan: 'docs/test-plan.md',
  app: 'src/App.jsx',
  api: 'src/api.js',
  homeScreen: 'src/screens/home.jsx',
  diagnoseScreen: 'src/screens/diagnose.jsx',
  detailScreen: 'src/screens/detail.jsx',
  index: 'server/index.mjs',
  services: 'server/services.mjs',
  planTemplates: 'server/planTemplates.mjs',
  seedData: 'server/seedData.mjs',
  store: 'server/store.mjs',
  storeRepository: 'server/storeRepository.mjs',
  utils: 'server/utils.mjs',
  e2e: 'scripts/e2e-phase1-mvp.mjs',
  e2eRunner: 'scripts/e2e-local-runner.mjs',
  legalGuard: 'scripts/legal-copy-guard.mjs',
  testsServices: 'tests/server-services.test.mjs',
  testsUtils: 'tests/server-utils.test.mjs',
  testsQuality: 'tests/quality-score.test.mjs',
  companySiteFixture: 'data/fixtures/company-sites/sample-corp.html',
  companyProfileFixture: 'data/fixtures/company-profiles/sample-corp.json',
  subsidyProgramsFixture: 'data/fixtures/subsidy-programs.json',
  expertPartnersFixture: 'data/fixtures/expert-partners.json',
  expertSources: 'docs/expert-sources.md',
}

export async function scoreProject(rootDir = process.cwd()) {
  const ctx = await loadProjectContext(rootDir)
  const modules = REQUIRED_MODULES.map((module) => {
    const items = module.items.map((item) => scoreItem(item, ctx))
    const score = round(items.reduce((sum, item) => sum + item.points, 0), 2)
    return {
      id: module.id,
      name: module.name,
      required: module.required,
      score,
      passed: score >= THRESHOLD,
      items,
    }
  })
  const averageScore = round(modules.reduce((sum, module) => sum + module.score, 0) / modules.length, 2)
  const failedModules = modules
    .filter((module) => !module.passed)
    .map((module) => ({ id: module.id, name: module.name, score: module.score }))

  return {
    schema: 'hojokin-pocket.phase1.quality-score.v1',
    generatedAt: new Date().toISOString(),
    rootDir,
    threshold: THRESHOLD,
    passed: failedModules.length === 0,
    averageScore,
    requiredModuleCount: REQUIRED_MODULES.length,
    failedModules,
    modules,
  }
}

export function renderHumanReport(summary) {
  const lines = [
    'Phase 1 required module quality score',
    `Threshold: ${summary.threshold.toFixed(1)} / 10 per module`,
    `Overall: ${summary.passed ? 'PASS' : 'FAIL'} (${summary.averageScore.toFixed(2)} average)`,
    '',
  ]

  for (const module of summary.modules) {
    lines.push(`${module.passed ? 'PASS' : 'FAIL'} ${module.id} ${module.name}: ${module.score.toFixed(2)} / 10`)
    for (const item of module.items) {
      lines.push(`  ${item.passed ? '+' : '-'} ${item.points.toFixed(2)}/${item.weight.toFixed(2)} ${item.label}`)
    }
  }

  if (summary.failedModules.length > 0) {
    lines.push('')
    lines.push('Failed modules:')
    for (const module of summary.failedModules) {
      lines.push(`- ${module.id} ${module.name}: ${module.score.toFixed(2)} / 10`)
    }
  }

  return lines.join('\n')
}

async function loadProjectContext(rootDir) {
  const files = {}
  const exists = {}
  await Promise.all(Object.entries(FILES).map(async ([key, relativePath]) => {
    const absolutePath = path.join(rootDir, relativePath)
    try {
      files[key] = await fs.readFile(absolutePath, 'utf8')
      exists[key] = true
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
      files[key] = ''
      exists[key] = false
    }
  }))

  files.requirements = await readFirstMatchingDoc(rootDir, (name) =>
    name.includes('Phase1_Codex') || name.includes('開発要件'))

  const fixtures = {
    companyProfile: parseJson(files.companyProfileFixture),
    subsidyPrograms: parseJson(files.subsidyProgramsFixture),
    expertPartners: parseJson(files.expertPartnersFixture),
  }

  const productSource = [
    files.app,
    files.api,
    files.homeScreen,
    files.diagnoseScreen,
    files.detailScreen,
    files.index,
    files.services,
    files.planTemplates,
    files.seedData,
    files.store,
    files.utils,
  ].join('\n')

  return {
    rootDir,
    files,
    exists,
    fixtures,
    productSource,
  }
}

async function readFirstMatchingDoc(rootDir, predicate) {
  const docsDir = path.join(rootDir, 'docs')
  let entries = []
  try {
    entries = await fs.readdir(docsDir)
  } catch {
    return ''
  }
  for (const entry of entries) {
    if (!predicate(entry)) continue
    try {
      return await fs.readFile(path.join(docsDir, entry), 'utf8')
    } catch {
      return ''
    }
  }
  return ''
}

function scoreItem(item, ctx) {
  let passed = false
  let error
  try {
    passed = Boolean(item.test(ctx))
  } catch (err) {
    error = err.message || String(err)
  }
  return {
    id: item.id,
    label: item.label,
    weight: item.weight,
    points: passed ? item.weight : 0,
    passed,
    evidence: item.evidence,
    ...(error ? { error } : {}),
  }
}

function check(label, weight, evidence, test) {
  return {
    id: slug(label),
    label,
    weight,
    evidence,
    test,
  }
}

function slug(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function hasAll(source, patterns) {
  return patterns.every((pattern) => {
    if (pattern instanceof RegExp) return pattern.test(source)
    return source.includes(pattern)
  })
}

function hasAllJson(value, keys) {
  return Boolean(value) && keys.every((key) => Object.prototype.hasOwnProperty.call(value, key))
}

function countMatches(source, needle) {
  if (!needle) return 0
  let count = 0
  let index = source.indexOf(needle)
  while (index !== -1) {
    count += 1
    index = source.indexOf(needle, index + needle.length)
  }
  return count
}

function parseJson(source) {
  if (!source.trim()) return null
  try {
    return JSON.parse(source)
  } catch {
    return null
  }
}

function round(value, digits) {
  const factor = 10 ** digits
  return Math.round((value + Number.EPSILON) * factor) / factor
}

function readRootArg(argv) {
  const equalsArg = argv.find((arg) => arg.startsWith('--root='))
  if (equalsArg) return path.resolve(equalsArg.slice('--root='.length))
  const rootIndex = argv.indexOf('--root')
  if (rootIndex !== -1 && argv[rootIndex + 1]) return path.resolve(argv[rootIndex + 1])
  return process.cwd()
}

const directRunPath = process.argv[1] ? path.resolve(process.argv[1]) : ''
const thisFilePath = fileURLToPath(import.meta.url)

if (directRunPath === thisFilePath) {
  const rootDir = readRootArg(process.argv.slice(2))
  const summary = await scoreProject(rootDir)
  console.log(renderHumanReport(summary))
  console.log('')
  console.log('JSON_RESULT_START')
  console.log(JSON.stringify(summary, null, 2))
  process.exit(summary.passed ? 0 : 1)
}
