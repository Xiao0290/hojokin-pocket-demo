#!/usr/bin/env node
import { promises as fs } from 'node:fs'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { scoreProject as scorePhase1 } from './score-phase1-modules.mjs'

export const MULTIDIM_THRESHOLD = 95

export const DIMENSIONS = [
  dimension('D01', 'Core MVP flow', 'Real URL diagnosis through proposal, plan, export, and waitlist.', [
    check('Phase 1 module gate is still green', 20, ['scripts/score-phase1-modules.mjs'], async (ctx) => ctx.phase1.passed),
    check('SAMPLE API E2E covers the full flow', 20, ['scripts/e2e-phase1-mvp.mjs'], (ctx) =>
      hasAll(ctx.files.e2e, ['https://www.sample-corp.example', 'get-expert-recommendations', 'export-docx', 'export-pdf'])),
    check('UI requires self-site attestation before diagnosis', 15, ['src/screens/home.jsx'], (ctx) =>
      hasAll(ctx.files.home, ['自社サイト', 'attested', 'disabled={!attested}'])),
    check('Result and detail UI show reasons, warnings, and source context', 15, ['src/screens/diagnose.jsx', 'src/screens/detail.jsx'], (ctx) =>
      hasAll(ctx.files.diagnose, ['reason-line', 'warning-text']) && hasAll(ctx.files.detail, ['おすすめ理由', '出典', '公式サイト'])),
    check('Business-plan draft supports streaming, editing, and export', 15, ['src/screens/detail.jsx', 'server/services.mjs'], (ctx) =>
      hasAll(ctx.files.detail, ['streamText', 'textarea', 'exportFile']) && hasAll(ctx.files.services, ['patchPlanSection', 'exportPlan'])),
    check('MyPage and notification settings are wired', 15, ['src/screens/home.jsx', 'server/index.mjs'], (ctx) =>
      hasAll(ctx.files.home, ['MyPage', '締切リマインド']) && ctx.files.index.includes('/v1/me/notifications/settings')),
  ]),
  dimension('D02', 'Security and input boundaries', 'URL, request, export, and local-dev boundaries.', [
    check('Server rejects diagnosis without self-site attestation', 18, ['server/services.mjs', 'server/index.mjs'], (ctx) =>
      hasAll(ctx.files.services, ['options.attested !== true', 'ご自身が管理する自社サイト']) &&
      ctx.files.index.includes('attested: body.attested === true')),
    check('SSRF behavior gate rejects private direct and redirect targets', 18, ['scripts/quality-behavior-gates.mjs'], (ctx) =>
      ctx.behaviorGates.passed && ctx.behaviorGates.output.includes('PASS ssrf')),
    check('Private and reserved network addresses are blocked', 14, ['server/utils.mjs', 'tests/server-utils.test.mjs'], (ctx) =>
      hasAll(ctx.files.utils, ['isPrivateIp', '169', '254']) &&
      hasAll(ctx.files.testsUtils, ['private and reserved IP ranges', '169.254.169.254'])),
    check('Request bodies have a hard size cap', 14, ['server/utils.mjs', 'tests/server-utils.test.mjs'], (ctx) =>
      hasAll(ctx.files.utils, ['MAX_BODY_BYTES', 'PAYLOAD_TOO_LARGE']) && ctx.files.testsUtils.includes('rejects oversized JSON bodies')),
    check('Store read-modify-write is serialized', 14, ['server/storeRepository.mjs', 'tests/store-repository-contract.test.mjs'], (ctx) =>
      hasAll(ctx.files.storeRepository, ['writeLock', 'writeLock.then', 'writeLock = run.catch']) &&
      ctx.files.testsStoreRepository.includes('serializes concurrent read-modify-write')),
    check('Exports are checked against signed unexpired export records', 12, ['server/index.mjs', 'server/services.mjs', 'server/objectStoragePort.mjs'], (ctx) =>
      hasAll(ctx.files.index, ['readExportDownload', 'token']) &&
      hasAll(ctx.files.services, ['export async function readExportDownload', 'verifySignedUrl', 'expiresAt', 'file.downloaded']) &&
      hasAll(ctx.files.objectStoragePort, ['signGetUrl', 'verifySignedUrl', 'validateStorageKey'])),
    check('API binds to loopback in local MVP', 10, ['server/index.mjs', 'README.md'], (ctx) =>
      ctx.files.index.includes("server.listen(port, '127.0.0.1'") && ctx.files.readme.includes('127.0.0.1')),
  ]),
  dimension('D03', 'Legal and compliance copy', 'Phase 1 scope, safe language, and active-document scanning.', [
    check('Legal guard scans README, src, server, and active docs', 20, ['scripts/legal-copy-guard.mjs'], (ctx) =>
      hasAll(ctx.files.legalGuard, ["'README.md'", "'src'", "'server'", "'docs'"])),
    check('Legal guard uses regex forbidden checks', 15, ['scripts/legal-copy-guard.mjs'], (ctx) =>
      hasAll(ctx.files.legalGuard, ['申請書を?AIで作成', '採択率[^。]{0,12}', 'jGrantsに提出'])),
    check('Legal guard has positive safe-copy assertions', 15, ['scripts/legal-copy-guard.mjs'], (ctx) =>
      hasAll(ctx.files.legalGuard, ['positiveAssertions', '下書き支援', '本人による下書き作成を支援'])),
    check('README states Phase 1 scope and exclusions', 20, ['README.md'], (ctx) =>
      hasAll(ctx.files.readme, ['Phase 1 の範囲', '下書き支援', 'Phase 1 では']) &&
      !/(jGrantsに提出|成功報酬|68%|89%)/u.test(ctx.files.readme)),
    check('UI uses information-match wording, not eligibility prediction wording', 15, ['src/screens/detail.jsx', 'src/screens/home.jsx'], (ctx) =>
      hasAll(ctx.files.detail, ['公開情報との一致度', '申請可否や採択可能性の判定ではありません']) &&
      ctx.files.home.includes('公開情報との一致')),
    check('Export disclaimer frames applicant confirmation', 15, ['server/seedData.mjs'], (ctx) =>
      hasAll(ctx.files.seedData, ['申請者ご本人による下書き作成を支援', '正式に受任した専門家'])),
  ]),
  dimension('D04', 'Data provenance', 'Fixture contracts, field evidence, trace records, and source display.', [
    check('Subsidy fixtures include field-level evidence and source notes', 20, ['data/fixtures/subsidy-programs.json'], (ctx) =>
      Array.isArray(ctx.fixtures.subsidies?.programs) &&
      ctx.fixtures.subsidies.programs.every((program) => Array.isArray(program.evidence) && program.evidence.length > 0 && Array.isArray(program.sourceNotes))),
    check('Company fixture records official-source caveats and citations', 15, ['data/fixtures/company-profiles/sample-corp.json'], (ctx) =>
      Array.isArray(ctx.fixtures.company?.evidence) && Array.isArray(ctx.fixtures.company?.citations) && Array.isArray(ctx.fixtures.company?.sourceNotes)),
    check('Data contract defines evidence fields and validation', 15, ['docs/data-contract.md'], (ctx) =>
      hasAll(ctx.files.dataContract, ['evidence[]', 'supports[]', 'Validation'])),
    check('Store source records use real hashes, not just ids', 15, ['server/storeRepository.mjs'], (ctx) =>
      hasAll(ctx.files.storeRepository, ['crypto.createHash', 'hashRoundSource', 'sha256'])),
    check('Detail UI shows source and last seen date', 15, ['src/screens/detail.jsx'], (ctx) =>
      hasAll(ctx.files.detail, ['最終確認', 'detail.program.sourceUrl'])),
    check('Docs describe official-source recheck rules', 20, ['docs/data-sources.md', 'docs/expert-sources.md'], (ctx) =>
      hasAll(ctx.files.dataSources, ['Re-check official pages', 'official']) && ctx.files.expertSources.includes('日本行政書士会連合会')),
  ]),
  dimension('D05', 'Matching and proposal quality', 'Ranking is explainable and caveated.', [
    check('Closed rounds are filtered before ranking output', 15, ['server/services.mjs'], (ctx) =>
      hasAll(ctx.files.services, ['eligible: round.status !==', '.filter((match) => match.eligible)'])),
    check('Score breakdown exposes component scores and total10', 20, ['server/services.mjs'], (ctx) =>
      hasAll(ctx.files.services, ['keywordFit', 'requirementFit', 'sourceReliability', 'total10'])),
    check('Proposal includes fit rationale, next actions, and caveats', 20, ['server/services.mjs'], (ctx) =>
      hasAll(ctx.files.services, ['whyThisFits', 'nextActions', 'caveats'])),
    check('Warnings surface unknown company and hard-rule confirmations', 15, ['server/services.mjs', 'src/screens/diagnose.jsx'], (ctx) =>
      hasAll(ctx.files.services, ['warnings:', 'needs_confirmation']) && ctx.files.diagnose.includes('warning-text')),
    check('Automated tests verify candidate count and no ineligible matches', 15, ['tests/server-services.test.mjs', 'scripts/e2e-phase1-mvp.mjs'], (ctx) =>
      hasAll(ctx.files.testsServices, ['matches.length >= 3']) && ctx.files.e2e.includes('eligible=false')),
    check('UI caveats avoid eligibility or adoption guarantees', 15, ['src/screens/detail.jsx'], (ctx) =>
      hasAll(ctx.files.detail, ['申請可否', '採択可能性', '公式サイト'])),
  ]),
  dimension('D06', 'Expert candidate integrity', 'Official-source candidate information with waitlist-only boundaries.', [
    check('At least five official-source expert candidates exist', 20, ['data/fixtures/expert-partners.json'], (ctx) =>
      Array.isArray(ctx.fixtures.experts) &&
      ctx.fixtures.experts.length >= 5 &&
      ctx.fixtures.experts.every((expert) => expert.verificationLevel === 'official_site' && expert.sourceUrl?.startsWith('https://'))),
    check('Expert score uses program, keyword, access, source, and compliance components', 15, ['server/services.mjs'], (ctx) =>
      hasAll(ctx.files.services, ['programFit', 'keywordFit', 'accessFit', 'sourceFit', 'complianceFit'])),
    check('API returns disclaimer and expert caveats', 15, ['server/services.mjs'], (ctx) =>
      hasAll(ctx.files.services, ['disclaimer:', 'caveats: expert.caveats'])),
    check('UI displays candidate caveats and information-match score', 20, ['src/screens/detail.jsx', 'src/screens/home.jsx'], (ctx) =>
      hasAll(ctx.files.detail, ['expert.caveats', '公開情報との一致']) && hasAll(ctx.files.home, ['expert.caveats', '行政書士候補情報'])),
    check('Lead creation records expertId but remains waitlist-only', 15, ['server/services.mjs', 'scripts/e2e-phase1-mvp.mjs'], (ctx) =>
      hasAll(ctx.files.services, ['expertId:', "status: 'waitlisted'"]) && hasAll(ctx.files.e2e, ['run.expertId', 'expert waitlist recorded'])),
    check('Payment and delegated filing flows are absent from product source', 15, ['src', 'server'], (ctx) =>
      !/(stripe|checkout|payment|決済|受任確定|委任契約を開始|jGrantsに提出)/iu.test(ctx.productSource)),
  ]),
  dimension('D07', 'Export integrity', 'Generated files include readable disclaimers and safe access.', [
    check('DOCX and PDF builders exist', 15, ['server/services.mjs'], (ctx) =>
      hasAll(ctx.files.services, ['makeDocx', 'makePdf', 'zipStore'])),
    check('PDF uses CJK Type0 font and UTF-16BE text', 20, ['server/services.mjs'], (ctx) =>
      hasAll(ctx.files.services, ['UniJIS-UCS2-H', 'HeiseiKakuGo-W5', 'utf16BeHex'])),
    check('Export records include disclaimer and expiry', 15, ['server/services.mjs'], (ctx) =>
      hasAll(ctx.files.services, ['disclaimerIncluded: true', 'expiresAt'])),
    check('Export behavior gate checks readable files, records, and expiry', 15, ['scripts/quality-behavior-gates.mjs'], (ctx) =>
      ctx.behaviorGates.passed && ctx.behaviorGates.output.includes('PASS export')),
    check('Tests read back DOCX and inspect PDF CJK structure', 20, ['tests/server-services.test.mjs'], (ctx) =>
      hasAll(ctx.files.testsServices, ['事業計画書', '申請者ご本人による下書き作成を支援', 'UniJIS-UCS2-H'])),
    check('E2E verifies both export formats', 15, ['scripts/e2e-phase1-mvp.mjs'], (ctx) =>
      hasAll(ctx.files.e2e, ['export-docx', 'export-pdf', 'disclaimerIncluded'])),
  ]),
  dimension('D08', 'Reliability and observability', 'State, events, and audit behavior are observable and failure-aware.', [
    check('Store mutations are serialized with regression coverage', 20, ['server/storeRepository.mjs', 'tests/store-repository-contract.test.mjs'], (ctx) =>
      hasAll(ctx.files.storeRepository, ['writeLock', 'mutate(mutator)']) &&
      ctx.files.testsStoreRepository.includes('serializes concurrent read-modify-write')),
    check('Plan generation failures emit plan.error', 15, ['server/services.mjs', 'server/index.mjs'], (ctx) =>
      hasAll(ctx.files.services, ['markPlanFailed', 'plan.error']) && ctx.files.index.includes("'plan.error'")),
    check('Diagnosis and plan SSE have polling fallback in UI/E2E', 15, ['src/screens/diagnose.jsx', 'src/screens/detail.jsx', 'scripts/e2e-phase1-mvp.mjs'], (ctx) =>
      hasAll(ctx.files.diagnose, ['openEvents', '接続を確認しています']) &&
      hasAll(ctx.files.detail, ['openEvents', '接続を確認しています']) &&
      ctx.files.e2e.includes('falling back to polling')),
    check('Audit logs cover major events', 20, ['server/services.mjs', 'scripts/e2e-phase1-mvp.mjs'], (ctx) =>
      ['diagnosis.completed', 'expert_recommendations.viewed', 'business_plan.exported', 'expert_waitlist.submitted', 'notification.setting_changed'].every((event) =>
        ctx.files.services.includes(event) && ctx.files.e2e.includes(event))),
    check('Analytics endpoint returns counts and recent events', 15, ['server/services.mjs', 'server/index.mjs'], (ctx) =>
      hasAll(ctx.files.services, ['eventCounts', 'events: store.auditLogs.slice(-100)']) && ctx.files.index.includes('/v1/analytics')),
    check('E2E runner resets local store to isolate runs', 15, ['scripts/e2e-local-runner.mjs'], (ctx) =>
      hasAll(ctx.files.e2eRunner, ['RESET_STORE', 'shutdown()'])),
  ]),
  dimension('D09', 'Verification depth', 'Local gates verify behavior, score, build, and E2E.', [
    check('Default test includes legal guard and unit tests', 10, ['package.json'], (ctx) =>
      hasAll(ctx.files.packageJson, ['test:legal-copy', 'test:unit'])),
    check('Regression tests cover attestation, redirects, body limit, store concurrency, export readback', 20, ['tests/server-services.test.mjs', 'tests/server-utils.test.mjs'], (ctx) =>
      ['rejects diagnosis without self-site attestation', 'blocks redirects to private network addresses', 'preserves concurrent store mutations', 'rejects oversized JSON bodies', '申請者ご本人による下書き作成を支援'].every((needle) =>
        ctx.files.testsServices.includes(needle) || ctx.files.testsUtils.includes(needle))),
    check('Phase1 and multidim score scripts are tested', 15, ['tests/quality-score.test.mjs'], (ctx) =>
      hasAll(ctx.files.testsQuality, ['scoreProject', 'scoreMultiDimProject', 'MULTIDIM_THRESHOLD'])),
    check('CI verification script chains behavior gate, build, score, and E2E', 20, ['package.json', 'scripts/quality-behavior-gates.mjs'], (ctx) =>
      hasAll(ctx.files.packageJson, ['verify:ci', 'test:quality-gates', 'score:phase1', 'score:multidim', 'test:e2e']) &&
      ctx.behaviorGates.passed &&
      ctx.behaviorGates.output.includes('PASS dev-fixture')),
    check('E2E expected analytics include major events', 10, ['scripts/e2e-phase1-mvp.mjs'], (ctx) =>
      hasAll(ctx.files.e2e, ['analyticsExpectedEvents', 'expert_recommendations.viewed'])),
    check('Synthetic company batch covers diagnosis, matching, expert candidates, plan, and export', 15, ['data/fixtures/synthetic-companies.mjs', 'tests/synthetic-batch.test.mjs'], (ctx) =>
      hasAll(ctx.files.syntheticFixture, ['syntheticCompanyScenarios', 'count: syntheticCompanyScenarios.length']) &&
      hasAll(ctx.files.testsSynthetic, ['syntheticCompanyScenarios.length, 15', 'recommendExperts', 'exportPlan'])),
    check('Browser artifact directory is documented by tests/e2e', 10, ['tests/e2e/README.md'], (ctx) =>
      ctx.files.e2eReadme.includes('Playwright') || ctx.files.e2eReadme.includes('browser')),
  ]),
  dimension('D10', 'GitHub and CI readiness', 'Repository has reproducible GitHub verification.', [
    check('GitHub Actions workflow exists', 25, ['.github/workflows/ci.yml'], (ctx) =>
      ctx.exists.githubCi && ctx.files.githubCi.includes('npm run verify:ci')),
    check('Workflow installs with npm ci', 15, ['.github/workflows/ci.yml'], (ctx) =>
      ctx.files.githubCi.includes('npm ci')),
    check('Workflow uploads quality or E2E artifacts', 15, ['.github/workflows/ci.yml'], (ctx) =>
      ctx.files.githubCi.includes('actions/upload-artifact')),
    check('Package exposes verify:ci command', 15, ['package.json'], (ctx) =>
      ctx.files.packageJson.includes('"verify:ci"')),
    check('README documents local and CI verification', 15, ['README.md'], (ctx) =>
      hasAll(ctx.files.readme, ['verify:ci', 'GitHub Actions'])),
    check('Workflow is scoped to main and pull requests', 15, ['.github/workflows/ci.yml'], (ctx) =>
      hasAll(ctx.files.githubCi, ['pull_request', 'main'])),
  ]),
]

const FILES = {
  packageJson: 'package.json',
  readme: 'README.md',
  home: 'src/screens/home.jsx',
  diagnose: 'src/screens/diagnose.jsx',
  detail: 'src/screens/detail.jsx',
  index: 'server/index.mjs',
  services: 'server/services.mjs',
  planTemplates: 'server/planTemplates.mjs',
  objectStoragePort: 'server/objectStoragePort.mjs',
  seedData: 'server/seedData.mjs',
  store: 'server/store.mjs',
  storeRepository: 'server/storeRepository.mjs',
  utils: 'server/utils.mjs',
  e2e: 'scripts/e2e-phase1-mvp.mjs',
  e2eRunner: 'scripts/e2e-local-runner.mjs',
  legalGuard: 'scripts/legal-copy-guard.mjs',
  testsServices: 'tests/server-services.test.mjs',
  testsStoreRepository: 'tests/store-repository-contract.test.mjs',
  testsSynthetic: 'tests/synthetic-batch.test.mjs',
  testsUtils: 'tests/server-utils.test.mjs',
  testsQuality: 'tests/quality-score.test.mjs',
  e2eReadme: 'tests/e2e/README.md',
  dataContract: 'docs/data-contract.md',
  dataSources: 'docs/data-sources.md',
  expertSources: 'docs/expert-sources.md',
  githubCi: '.github/workflows/ci.yml',
  subsidyFixture: 'data/fixtures/subsidy-programs.json',
  companyFixture: 'data/fixtures/company-profiles/sample-corp.json',
  expertFixture: 'data/fixtures/expert-partners.json',
  syntheticFixture: 'data/fixtures/synthetic-companies.mjs',
  qualityBehaviorGate: 'scripts/quality-behavior-gates.mjs',
}

export async function scoreMultiDimProject(rootDir = process.cwd()) {
  const ctx = await loadContext(rootDir)
  const dimensions = await Promise.all(DIMENSIONS.map(async (dimension) => {
    const items = await Promise.all(dimension.items.map((item) => scoreItem(item, ctx)))
    const score = round(items.reduce((sum, item) => sum + item.points, 0), 2)
    return {
      id: dimension.id,
      name: dimension.name,
      required: dimension.required,
      score,
      passed: score >= MULTIDIM_THRESHOLD,
      items,
    }
  }))
  const failedDimensions = dimensions
    .filter((dimension) => !dimension.passed)
    .map((dimension) => ({ id: dimension.id, name: dimension.name, score: dimension.score }))
  const averageScore = round(dimensions.reduce((sum, dimension) => sum + dimension.score, 0) / dimensions.length, 2)

  return {
    schema: 'hojokin-pocket.multidim-score.v1',
    generatedAt: new Date().toISOString(),
    rootDir,
    threshold: MULTIDIM_THRESHOLD,
    passed: failedDimensions.length === 0,
    averageScore,
    dimensionCount: dimensions.length,
    failedDimensions,
    dimensions,
    evidence: {
      commands: [
        'npm run test',
        'npm run score:phase1',
        'npm run score:multidim',
        'npm run build',
        'npm run test:e2e',
      ],
    },
  }
}

export function renderMultiDimReport(summary) {
  const lines = [
    'Hojokin Pocket multidimensional quality score',
    `Threshold: ${summary.threshold} / 100 per dimension`,
    `Overall: ${summary.passed ? 'PASS' : 'FAIL'} (${summary.averageScore.toFixed(2)} average)`,
    '',
  ]

  for (const dimension of summary.dimensions) {
    lines.push(`${dimension.passed ? 'PASS' : 'FAIL'} ${dimension.id} ${dimension.name}: ${dimension.score.toFixed(2)} / 100`)
    for (const item of dimension.items) {
      lines.push(`  ${item.passed ? '+' : '-'} ${item.points.toFixed(2)}/${item.weight.toFixed(2)} ${item.label}`)
    }
  }

  if (summary.failedDimensions.length > 0) {
    lines.push('')
    lines.push('Failed dimensions:')
    for (const dimension of summary.failedDimensions) {
      lines.push(`- ${dimension.id} ${dimension.name}: ${dimension.score.toFixed(2)} / 100`)
    }
  }

  return lines.join('\n')
}

async function loadContext(rootDir) {
  const files = {}
  const exists = {}
  await Promise.all(Object.entries(FILES).map(async ([key, relativePath]) => {
    const absolute = path.join(rootDir, relativePath)
    try {
      files[key] = await fs.readFile(absolute, 'utf8')
      exists[key] = true
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
      files[key] = ''
      exists[key] = false
    }
  }))

  const fixtures = {
    subsidies: parseJson(files.subsidyFixture),
    company: parseJson(files.companyFixture),
    experts: parseJson(files.expertFixture),
  }

  const productSource = [
    files.home,
    files.diagnose,
    files.detail,
    files.index,
    files.services,
    files.planTemplates,
    files.store,
    files.utils,
  ].join('\n')

  return {
    rootDir,
    files,
    exists,
    fixtures,
    productSource,
    behaviorGates: runBehaviorGates(rootDir),
    phase1: await scorePhase1(rootDir),
  }
}

function runBehaviorGates(rootDir) {
  const result = spawnSync(process.execPath, ['scripts/quality-behavior-gates.mjs', '--probe-only'], {
    cwd: rootDir,
    encoding: 'utf8',
    timeout: 45_000,
    env: cleanProbeEnv(process.env),
  })
  return {
    passed: result.status === 0,
    output: `${result.stdout || ''}\n${result.stderr || ''}`,
  }
}

function cleanProbeEnv(env) {
  const next = { ...env }
  delete next.RUNTIME_DIR
  delete next.EXPORT_DIR
  delete next.API_PORT
  delete next.RESET_STORE
  delete next.SYNTHETIC_FIXTURE_MODE
  return next
}

async function scoreItem(item, ctx) {
  let passed = false
  let error
  try {
    passed = Boolean(await item.test(ctx))
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

function dimension(idValue, name, required, items) {
  const total = items.reduce((sum, item) => sum + item.weight, 0)
  if (total !== 100) throw new Error(`${idValue} weights must total 100, got ${total}`)
  return { id: idValue, name, required, items }
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
  const summary = await scoreMultiDimProject(rootDir)
  console.log(renderMultiDimReport(summary))
  console.log('')
  console.log('JSON_RESULT_START')
  console.log(JSON.stringify(summary, null, 2))
  process.exit(summary.passed ? 0 : 1)
}
