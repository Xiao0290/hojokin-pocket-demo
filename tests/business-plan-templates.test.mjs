import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test, { after, beforeEach } from 'node:test'
import { activeSubsidyRounds } from '../server/fixtures.mjs'
import {
  PLAN_TEMPLATE_VERSION,
  buildPlanSectionsLocalMock,
  listPlanTemplates,
  selectPlanTemplate,
} from '../server/planTemplates.mjs'

const testRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'hojokin-pocket-plan-templates-'))
process.env.RUNTIME_DIR = path.join(testRoot, 'runtime')
process.env.EXPORT_DIR = path.join(testRoot, 'exports')

const services = await import('../server/services.mjs')
const store = await import('../server/store.mjs')

const {
  confirmBusinessPlanDraft,
  createBusinessPlan,
  exportPlan,
  getPlan,
  readExportDownload,
} = services
const { mutateStore, resetStore } = store

const expectedTemplates = new Map([
  ['jizokuka-normal-20', 'market-development'],
  ['monodukuri-23', 'capital-investment'],
  ['it-digital-ai-2026-normal-3', 'digital-tool'],
  ['shoukei-ma-15', 'succession-ma'],
  ['shoryokuka-ippan-7', 'labor-saving'],
])

after(async () => {
  await fs.rm(testRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 })
})

beforeEach(async () => {
  await resetStore()
  await seedTemplateCompany()
})

test('subsidy rounds select stable subsidy-specific business plan templates', () => {
  const catalog = listPlanTemplates()
  assert.ok(catalog.length >= 5)
  assert.ok(new Set(catalog.map((template) => template.category)).size >= 5)
  assert.ok(catalog.every((template) => template.version === PLAN_TEMPLATE_VERSION))

  for (const round of activeSubsidyRounds) {
    const expected = expectedTemplates.get(round.roundId)
    if (!expected) continue
    assert.equal(selectPlanTemplate(round).id, expected, `${round.roundId} should use ${expected}`)
  }
})

test('local plan sections carry template metadata, sources, documents, and confirmation flags', () => {
  const profile = templateCompanyProfile()

  for (const [roundId, expectedTemplate] of expectedTemplates) {
    const round = activeSubsidyRounds.find((item) => item.roundId === roundId)
    const sections = buildPlanSectionsLocalMock(profile, round, { targetChars: 4200 })

    assert.equal(sections.length, 5)
    assert.equal(sections[0].templateId, expectedTemplate)
    assert.ok(sections.every((section) => section.templateName))
    assert.ok(sections.some((section) => section.sources.length > 0), `${roundId} should include source references`)
    assert.ok(sections.some((section) => section.requiredDocumentRefs.length > 0), `${roundId} should include documents`)
    assert.ok(sections.some((section) => section.confirmationFlags.length > 0), `${roundId} should include confirmations`)
    assert.ok(sections.some((section) => section.needsConfirmation === true), `${roundId} should require applicant confirmation`)
  }
})

test('created plans and DOCX/PDF exports include selected template content and disclaimer', async () => {
  const exportCases = [
    ['it-digital-ai-2026-normal-3', 'IT・AI導入準備テンプレート'],
    ['shoryokuka-ippan-7', '省力化投資テンプレート'],
    ['jizokuka-normal-20', '販路開拓・経営計画テンプレート'],
  ]

  for (const [roundId, templateName] of exportCases) {
    const planStart = await createBusinessPlan({
      companyId: 'company_template_test',
      roundId,
      targetChars: 4200,
    })
    const plan = await waitFor(() => getPlan(planStart.planId), (value) => value?.status === 'draft')
    const round = activeSubsidyRounds.find((item) => item.roundId === roundId)

    assert.equal(plan.template.name, templateName)
    assert.equal(plan.generation.templateId, selectPlanTemplate(round).id)
    assert.equal(plan.requiredDocumentChecklist.length, round.requiredDocuments.length)
    assert.ok(plan.sourceReferences.some((source) => source.url === round.program.sourceUrl))
    assert.ok(plan.confirmationFlags.length >= 6)
    assert.ok(plan.sections.some((section) => section.requiredDocumentRefs.length > 0))

    await confirmDraft(plan.id)
    const docx = await exportPlan(plan.id, 'docx')
    const docxBuffer = (await readExportDownload(docx.filename, tokenFromUrl(docx.fileUrl))).body
    const docxText = readDocxText(docxBuffer)
    assert.match(docxText, new RegExp(templateName))
    assert.match(docxText, new RegExp(escapeRegExp(round.program.sourceUrl)))
    assert.match(docxText, new RegExp(escapeRegExp(round.requiredDocuments[0].label)))
    assert.match(docxText, /申請者ご本人による下書き作成を支援/)

    const pdf = await exportPlan(plan.id, 'pdf')
    const pdfBuffer = (await readExportDownload(pdf.filename, tokenFromUrl(pdf.fileUrl))).body
    const pdfText = extractPdfUtf16Text(pdfBuffer)
    assert.match(pdfText, new RegExp(templateName))
    assert.match(pdfText, /本人確認項目/)
    assert.match(pdfText, /申請者ご本人による下書き作成を支援/)
  }
})

async function confirmDraft(planId) {
  return confirmBusinessPlanDraft(planId, {
    draftResponsibility: true,
    sourceReview: true,
    noDelegatedFiling: true,
  })
}

async function seedTemplateCompany() {
  await mutateStore((draft) => {
    draft.companies.push({
      id: 'company_template_test',
      userId: 'usr_dev_owner',
      name: 'テンプレート検証株式会社',
      url: 'https://template-test.example/',
      prefecture: '東京都',
      city: '千代田区',
      profile: templateCompanyProfile(),
      sourceCitations: [],
      analyzedAt: '2026-06-20T00:00:00.000Z',
      createdAt: '2026-06-20T00:00:00.000Z',
    })
  })
}

function templateCompanyProfile() {
  return {
    id: 'profile_template_test',
    name: 'テンプレート検証株式会社',
    businessSummary: '東京都で宿泊運営、AI業務自動化、販路開拓、省力化設備、事業承継準備を進める検証用会社です。',
    keywords: ['宿泊運営', 'AI業務自動化', '販路開拓', '省力化', '設備投資', '事業承継'],
    citations: [{ url: 'https://template-test.example/', label: '会社公式サイト' }],
    unknowns: ['従業員数', '資本金'],
  }
}

async function waitFor(load, predicate, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs
  let value
  while (Date.now() < deadline) {
    value = await load()
    if (predicate(value)) return value
    if (value?.status === 'failed') {
      throw new Error(JSON.stringify(value.error || value))
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error(`Timed out waiting for condition. Last value: ${JSON.stringify(value)}`)
}

function tokenFromUrl(fileUrl) {
  return new URL(fileUrl, 'http://local.invalid').searchParams.get('token')
}

function readDocxText(buffer) {
  const raw = buffer.toString('utf8')
  const documentXml = raw.match(/<w:document[\s\S]*<\/w:document>/)?.[0] || raw
  return decodeXml(documentXml
    .replace(/<\/w:p>/g, '\n')
    .replace(/<[^>]+>/g, ' '))
}

function extractPdfUtf16Text(buffer) {
  const raw = buffer.toString('latin1')
  const textRuns = [...raw.matchAll(/<([0-9A-F]+)> Tj/g)]
  return textRuns.map((match) => {
    const be = Buffer.from(match[1], 'hex')
    const le = Buffer.alloc(be.length)
    for (let index = 0; index < be.length; index += 2) {
      le[index] = be[index + 1]
      le[index + 1] = be[index]
    }
    return le.toString('utf16le')
  }).join('\n')
}

function decodeXml(value) {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
