import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test, { after } from 'node:test'

const testRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'hojokin-pocket-services-'))
process.env.RUNTIME_DIR = path.join(testRoot, 'runtime')
process.env.EXPORT_DIR = path.join(testRoot, 'exports')

const services = await import('../server/services.mjs')
const store = await import('../server/store.mjs')

const {
  analytics,
  confirmBusinessPlanDraft,
  configureServicePorts,
  createBusinessPlan,
  createDiagnosis,
  createLead,
  exportPlan,
  getDiagnosis,
  getExportRecord,
  getMatches,
  getPlan,
  getRound,
  readExportDownload,
  listUserData,
  patchPlanSection,
  recommendExperts,
  resetServicePorts,
  validateRedirectLocation,
  updateApplicantConfirmations,
  updateNotificationSettings,
} = services
const { loadStore, mutateStore, resetStore } = store

after(async () => {
  await fs.rm(testRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 })
})

serialTest('runs the local diagnosis-to-export service flow for SAMPLE', async () => {
  await resetStore()

  const diagnosisStart = await createDiagnosis('https://www.sample-corp.example', { attested: true })
  const diagnosis = await waitFor(async () => getDiagnosis(diagnosisStart.diagnosisId), (value) => value?.status === 'done')

  assert.equal(diagnosis.company.name, '株式会社サンプル商会')
  assert.ok(diagnosis.matchCount >= 3)
  assert.ok(diagnosis.totalLimit > 0)

  const matchesResult = await getMatches(diagnosis.id)
  assert.ok(matchesResult.matches.length >= 3)
  assert.ok(matchesResult.company.citations[0].url.includes('sample-corp.example'))
  assert.equal(matchesResult.provenance.matcher, 'local_keyword_signal_v1')
  assert.equal(matchesResult.provenance.directSignalRequired, true)
  assert.equal(matchesResult.provenance.fixedRecommendationSet, false)
  assert.ok(matchesResult.matches.every((match) => match.signalMatched === true))

  const firstMatch = matchesResult.matches[0]
  const round = getRound(firstMatch.roundId)
  assert.ok(round.program.sourceUrl.startsWith('https://'))
  assert.ok(round.requiredDocuments.length > 0)

  const expertResult = await recommendExperts({ diagnosisId: diagnosis.id, roundId: firstMatch.roundId })
  assert.ok(expertResult.recommendations.length >= 3)
  assert.ok(expertResult.recommendations[0].score >= 8.5)
  assert.ok(expertResult.recommendations[0].sourceUrl.startsWith('https://'))

  const planStart = await createBusinessPlan({
    companyId: diagnosis.company.id,
    roundId: firstMatch.roundId,
    targetChars: 4200,
  })
  const plan = await waitFor(async () => getPlan(planStart.planId), (value) => value?.status === 'draft')
  assert.ok(plan.sections.length >= 5)
  assert.equal(plan.generation.provider, 'local_mock')
  assert.equal(plan.generation.mode, 'deterministic_template')
  assert.equal(plan.generation.model, null)
  assert.equal(plan.generation.llm, false)

  const edited = await patchPlanSection(plan.id, 1, `${plan.sections[0].body}\nE2E service edit marker`, 'edited')
  assert.equal(edited.status, 'edited')

  await confirmDraft(plan.id)
  const docx = await exportPlan(plan.id, 'docx')
  const pdf = await exportPlan(plan.id, 'pdf')
  assert.equal(docx.disclaimerIncluded, true)
  assert.equal(pdf.disclaimerIncluded, true)
  assert.equal(docx.filePath, undefined)
  assert.equal(pdf.filePath, undefined)
  assert.ok(docx.fileUrl.includes('token='))
  assert.ok(pdf.fileUrl.includes('token='))
  const docxBuffer = (await readExportDownload(docx.filename, tokenFromUrl(docx.fileUrl))).body
  const pdfBuffer = (await readExportDownload(pdf.filename, tokenFromUrl(pdf.fileUrl))).body
  assert.equal(docxBuffer.slice(0, 2).toString('utf8'), 'PK')
  assert.equal(pdfBuffer.slice(0, 5).toString('utf8'), '%PDF-')
  const docxText = readDocxText(docxBuffer)
  assert.match(docxText, /事業計画書/)
  assert.match(docxText, /申請者ご本人による下書き作成を支援/)
  assert.match(docxText, /E2E service edit marker/)
  const pdfText = readPdfText(null, pdfBuffer)
  assert.match(pdfBuffer.toString('latin1'), /\/UniJIS-UCS2-H/)
  assert.match(pdfBuffer.toString('latin1'), /\/HeiseiKakuGo-W5/)
  assert.match(pdfText.text, /事業計画書/)
  assert.match(pdfText.text, /申請者ご本人による下書き作成を支援/)
  assert.match(pdfText.text, /E2E service edit marker/)

  await createLead({ diagnosisId: diagnosis.id, roundId: firstMatch.roundId, expertId: expertResult.recommendations[0].id })
  await updateNotificationSettings({ push: true, email: true, deadline: true })

  const report = await analytics()
  const eventNames = new Set(report.events.map((event) => event.event))
  assert.equal(eventNames.has('diagnosis.completed'), true)
  assert.equal(eventNames.has('expert_recommendations.viewed'), true)
  assert.equal(eventNames.has('business_plan.exported'), true)
  assert.equal(eventNames.has('expert_waitlist.submitted'), true)
  assert.equal(eventNames.has('notification.setting_changed'), true)
  const planStarted = report.events.find((event) => event.event === 'business_plan.started')
  assert.equal(planStarted.payload.generation.provider, 'local_mock')
  assert.equal(planStarted.payload.generation.llm, false)
})

serialTest('rejects diagnosis without self-site attestation', async () => {
  await resetStore()

  await assert.rejects(
    () => createDiagnosis('https://www.sample-corp.example'),
    /自社サイト/,
  )
})

serialTest('does not return fixed subsidy recommendations for no-signal public-site profiles', async () => {
  await resetStore()
  configureServicePorts({
    DiagnosisExtractor: {
      extract: async (url) => ({
        html: '<html><head><title>Example Domain</title></head><body>Example Domain for documentation examples only.</body></html>',
        finalUrl: url.href,
        warnings: [],
        profile: {
          id: 'profile_no_signal_example',
          name: 'Example Domain',
          url: url.href,
          prefecture: null,
          city: null,
          businessSummary: 'Example Domain for documentation examples only.',
          pageTitle: 'Example Domain',
          headings: [],
          keywords: [],
          evidenceSnippets: [],
          extractionQuality: { score: 8.5, level: 'usable', missingFields: [] },
          unknowns: [],
          citations: [{ url: url.href, label: 'No-signal public-site fixture' }],
          sourceType: 'live_fetch',
          extractedAt: '2026-06-20T00:00:00.000Z',
        },
      }),
    },
  })

  try {
    const diagnosisStart = await createDiagnosis('https://example.com', { attested: true })
    const diagnosis = await waitFor(async () => getDiagnosis(diagnosisStart.diagnosisId), (value) => value?.status === 'done')
    assert.equal(diagnosis.matchCount, 0)
    assert.equal(diagnosis.totalLimit, 0)
    assert.equal(diagnosis.matchingProvenance.directSignalRequired, true)
    assert.equal(diagnosis.matchingProvenance.returnedMatchCount, 0)

    const matchesResult = await getMatches(diagnosis.id)
    assert.equal(matchesResult.matches.length, 0)
    assert.equal(matchesResult.summary.totalLimit, 0)
    assert.equal(matchesResult.provenance.companySourceType, 'live_fetch')
    assert.equal(matchesResult.provenance.directSignalRequired, true)
    assert.equal(matchesResult.provenance.returnedMatchCount, 0)
    assert.equal(matchesResult.provenance.fixedRecommendationSet, false)
  } finally {
    resetServicePorts()
  }
})

serialTest('stores applicant confirmations with diagnosis context and separates hard-rule status from soft score', async () => {
  await resetStore()

  const diagnosisStart = await createDiagnosis('https://www.sample-corp.example', { attested: true })
  const diagnosis = await waitFor(async () => getDiagnosis(diagnosisStart.diagnosisId), (value) => value?.status === 'done')

  const result = await updateApplicantConfirmations(diagnosis.id, {
    answers: {
      prefecture: '東京都',
      city: '千代田区',
      employeeCount: 8,
      capitalYen: 5_000_000,
      businessType: 'sme',
      plannedInvestmentYen: 1_500_000,
      estimateStatus: 'obtained',
      gBizIDReadiness: 'ready',
      targetTiming: 'within_3_months',
    },
  })

  assert.equal(result.applicantConfirmations.context.diagnosisId, diagnosis.id)
  assert.equal(result.applicantConfirmations.context.inputUrl, 'https://www.sample-corp.example/')
  assert.equal(result.applicantConfirmations.confirmedFields.includes('plannedInvestmentYen'), true)
  assert.ok(['eligible', 'needs_confirmation', 'mismatch'].includes(result.matches[0].hardRuleStatus))
  assert.equal(typeof result.matches[0].softFit.score, 'number')

  const latestDiagnosis = await getDiagnosis(diagnosis.id)
  assert.equal(latestDiagnosis.applicantConfirmations.answers.employeeCount, 8)

  const stored = await loadStore()
  assert.equal(stored.applicantConfirmations[0].diagnosisId, diagnosis.id)
  assert.equal(stored.applicantConfirmations[0].context.companyId, diagnosis.company.id)
  const audit = stored.auditLogs.find((item) => item.event === 'confirmation.updated')
  assert.ok(audit)
  assert.equal(audit.payload.diagnosisId, diagnosis.id)
})

serialTest('flags contradictory applicant location answers without overwriting public evidence', async () => {
  await resetStore()

  const diagnosisStart = await createDiagnosis('https://www.sample-corp.example', { attested: true })
  const diagnosis = await waitFor(async () => getDiagnosis(diagnosisStart.diagnosisId), (value) => value?.status === 'done')
  await mutateStore((store) => {
    const company = store.companies.find((item) => item.id === diagnosis.company.id)
    company.prefecture = '東京都'
    company.city = '千代田区'
    company.profile.prefecture = '東京都'
    company.profile.city = '千代田区'
  })
  const result = await updateApplicantConfirmations(diagnosis.id, {
    answers: {
      prefecture: '沖縄県',
      city: '那覇市',
      employeeCount: 8,
      capitalYen: 5_000_000,
      businessType: 'sme',
      plannedInvestmentYen: 1_500_000,
      estimateStatus: 'obtained',
      gBizIDReadiness: 'ready',
      targetTiming: 'within_3_months',
    },
  })

  assert.ok(result.applicantConfirmations.warnings.some((warning) => warning.includes('都道府県')))
  assert.equal(result.company.prefecture, '東京都')
})

serialTest('treats negative applicant size answers as hard-rule mismatch', async () => {
  await resetStore()

  const diagnosisStart = await createDiagnosis('https://www.sample-corp.example', { attested: true })
  const diagnosis = await waitFor(async () => getDiagnosis(diagnosisStart.diagnosisId), (value) => value?.status === 'done')
  const result = await updateApplicantConfirmations(diagnosis.id, {
    answers: {
      prefecture: '東京都',
      city: '千代田区',
      employeeCount: -1,
      capitalYen: -5_000_000,
      businessType: 'sme',
      plannedInvestmentYen: 1_500_000,
      estimateStatus: 'obtained',
      gBizIDReadiness: 'ready',
      targetTiming: 'within_3_months',
    },
  })

  assert.equal(result.matches[0].hardRuleStatus, 'mismatch')
  assert.ok(result.matches[0].hardRule.checks.some((check) => (
    check.field === 'businessSize' && check.status === 'mismatch'
  )))
  assert.ok(result.applicantConfirmations.warnings.some((warning) => warning.includes('負の値')))
})

serialTest('preserves concurrent store mutations', async () => {
  await resetStore()

  await Promise.all(Array.from({ length: 50 }, (_, index) =>
    mutateStore((store) => {
      store.diagnoses.push({
        id: `concurrent_${index}`,
        status: 'done',
        companyId: `company_${index}`,
        userId: 'test',
      })
    })))

  const store = await loadStore()
  assert.equal(store.diagnoses.filter((item) => item.id.startsWith('concurrent_')).length, 50)
})

serialTest('exports long Japanese edited draft content without silent PDF truncation', async () => {
  await resetStore()
  await mutateStore((store) => {
    store.companies.push({
      id: 'company_long_export',
      userId: 'usr_dev_owner',
      name: '長文検証株式会社',
      url: 'https://long-export.example/',
      prefecture: '東京都',
      city: '千代田区',
      profile: {
        id: 'profile_long_export',
        name: '長文検証株式会社',
        businessSummary: '東京都内で宿泊運営とAI業務自動化を行う小規模事業者です。',
        keywords: ['宿泊運営', 'AI業務自動化', '省力化'],
        citations: [{ url: 'https://long-export.example/', label: '開発用公式サイト' }],
        unknowns: ['資本金'],
      },
      sourceCitations: [],
      analyzedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    })
  })

  const planStart = await createBusinessPlan({
    companyId: 'company_long_export',
    roundId: 'shoryokuka-ippan-7',
    targetChars: 12000,
  })
  const plan = await waitFor(async () => getPlan(planStart.planId), (value) => value?.status === 'draft')
  const longContent = [
    '編集済み長文マーカー: 提出前に本人確認する章です。',
    ...Array.from({ length: 140 }, (_, index) =>
      `長文検証${String(index + 1).padStart(3, '0')}: 対象経費を公式公募要領で確認します。`),
    '長文最終マーカー: PDFの末尾まで保持されます。',
  ].join('\n')
  await patchPlanSection(plan.id, 2, longContent, 'edited')

  await confirmDraft(plan.id)
  const docx = await exportPlan(plan.id, 'docx')
  const pdf = await exportPlan(plan.id, 'pdf')
  const docxBuffer = (await readExportDownload(docx.filename, tokenFromUrl(docx.fileUrl))).body
  const pdfBuffer = (await readExportDownload(pdf.filename, tokenFromUrl(pdf.fileUrl))).body
  const docxText = readDocxText(docxBuffer)
  const pdfText = readPdfText(null, pdfBuffer)

  assert.ok(countPdfPages(pdfBuffer) > 1, 'long PDF export should create multiple pages')
  for (const exportedText of [docxText, pdfText.text]) {
    assert.match(exportedText, /1\. 事業概要/)
    assert.match(exportedText, /2\. 課題と投資の必要性/)
    assert.match(exportedText, /編集済み長文マーカー/)
    assert.match(exportedText, /長文検証001/)
    assert.match(exportedText, /長文検証140/)
    assert.match(exportedText, /長文最終マーカー/)
    assert.match(exportedText, /申請者ご本人による下書き作成を支援/)
  }
})

serialTest('business plan chapter 1 does not duplicate company name when summary already names the company', async () => {
  await resetStore()
  await mutateStore((store) => {
    store.companies.push({
      id: 'company_duplicate_name',
      userId: 'usr_dev_owner',
      name: '株式会社重複テスト',
      url: 'https://duplicate-name.example/',
      prefecture: '長野県',
      city: '松本市',
      profile: {
        id: 'profile_duplicate_name',
        name: '株式会社重複テスト',
        businessSummary: '株式会社重複テストは、長野県で省力化設備と販路開拓を進める事業者です。',
        keywords: ['省力化', '販路開拓'],
        citations: [{ url: 'https://duplicate-name.example/', label: '開発用公式サイト' }],
        unknowns: [],
      },
      sourceCitations: [],
      analyzedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    })
  })

  const planStart = await createBusinessPlan({
    companyId: 'company_duplicate_name',
    roundId: 'jizokuka-normal-20',
    targetChars: 4200,
  })
  const plan = await waitFor(async () => getPlan(planStart.planId), (value) => value?.status === 'draft')
  const chapter1 = plan.sections.find((section) => section.chapterNo === 1)
  assert.ok(chapter1)
  assert.match(chapter1.body, /^株式会社重複テストは、長野県/u)
  assert.doesNotMatch(chapter1.body, /株式会社重複テストは、株式会社重複テスト/u)
})

serialTest('service access boundary hides another user records', async () => {
  await resetStore()
  resetServicePorts()
  await mutateStore((store) => {
    store.users.push(
      { id: 'user_boundary_a', email: 'a@example.test', role: 'owner' },
      { id: 'user_boundary_b', email: 'b@example.test', role: 'owner' },
    )
    store.companies.push(
      {
        id: 'company_boundary_a',
        userId: 'user_boundary_a',
        name: '境界A株式会社',
        profile: {
          name: '境界A株式会社',
          businessSummary: 'A user company.',
          keywords: ['省力化'],
          citations: [],
          unknowns: [],
        },
      },
      {
        id: 'company_boundary_b',
        userId: 'user_boundary_b',
        name: '境界B株式会社',
        profile: {
          name: '境界B株式会社',
          businessSummary: 'B user company.',
          keywords: ['販路開拓'],
          citations: [],
          unknowns: [],
        },
      },
    )
    store.diagnoses.push(
      {
        id: 'diag_boundary_a',
        userId: 'user_boundary_a',
        companyId: 'company_boundary_a',
        status: 'done',
        inputUrl: 'https://a.example/',
        events: [{ event: 'diagnosis.done', data: {}, createdAt: new Date().toISOString() }],
      },
      {
        id: 'diag_boundary_b',
        userId: 'user_boundary_b',
        companyId: 'company_boundary_b',
        status: 'done',
        inputUrl: 'https://b.example/',
        events: [{ event: 'diagnosis.done', data: {}, createdAt: new Date().toISOString() }],
      },
    )
    store.matches.push(
      { id: 'match_boundary_a', userId: 'user_boundary_a', diagnosisId: 'diag_boundary_a', eligible: true, rank: 1, maxLimit: 1000 },
      { id: 'match_boundary_b', userId: 'user_boundary_b', diagnosisId: 'diag_boundary_b', eligible: true, rank: 1, maxLimit: 2000 },
    )
    store.plans.push(
      {
        id: 'plan_boundary_a',
        userId: 'user_boundary_a',
        companyId: 'company_boundary_a',
        roundId: 'shoryokuka-ippan-7',
        status: 'draft',
        sections: [{ chapterNo: 1, body: 'A', status: 'ai_draft', revision: 1 }],
        exports: [{ fileUrl: '/exports/plan_boundary_a.docx', expiresAt: '2099-01-01T00:00:00.000Z' }],
      },
      {
        id: 'plan_boundary_b',
        userId: 'user_boundary_b',
        companyId: 'company_boundary_b',
        roundId: 'shoryokuka-ippan-7',
        status: 'draft',
        sections: [{ chapterNo: 1, body: 'B', status: 'ai_draft', revision: 1 }],
        exports: [{ fileUrl: '/exports/plan_boundary_b.docx', expiresAt: '2099-01-01T00:00:00.000Z' }],
      },
    )
    store.leads.push(
      { id: 'lead_boundary_a', userId: 'user_boundary_a' },
      { id: 'lead_boundary_b', userId: 'user_boundary_b' },
    )
    store.auditLogs.push(
      { id: 'audit_boundary_a', userId: 'user_boundary_a', event: 'a' },
      { id: 'audit_boundary_b', userId: 'user_boundary_b', event: 'b' },
    )
  })

  configureServicePorts({
    AuthProvider: {
      currentUser: () => ({ id: 'user_boundary_a', email: 'a@example.test', role: 'owner' }),
    },
  })

  try {
    assert.equal((await getDiagnosis('diag_boundary_a')).company.id, 'company_boundary_a')
    assert.equal(await getDiagnosis('diag_boundary_b'), null)
    assert.equal((await getMatches('diag_boundary_a')).matches[0].id, 'match_boundary_a')
    assert.equal(await getMatches('diag_boundary_b'), null)
    assert.equal((await getPlan('plan_boundary_a')).id, 'plan_boundary_a')
    assert.equal(await getPlan('plan_boundary_b'), null)
    assert.equal((await getExportRecord('plan_boundary_a.docx')).planId, 'plan_boundary_a')
    assert.equal(await getExportRecord('plan_boundary_b.docx'), null)

    const myData = await listUserData()
    assert.deepEqual(myData.companies.map((item) => item.id), ['company_boundary_a'])
    assert.deepEqual(myData.diagnoses.map((item) => item.id), ['diag_boundary_a'])
    assert.deepEqual(myData.plans.map((item) => item.id), ['plan_boundary_a'])
    assert.deepEqual(myData.leads.map((item) => item.id), ['lead_boundary_a'])
    assert.equal(myData.auditLogs.some((item) => item.id === 'audit_boundary_a'), true)
    assert.equal(myData.auditLogs.some((item) => item.id === 'audit_boundary_b'), false)
    assert.equal(myData.auditLogs.every((item) => item.userId === 'user_boundary_a'), true)

    await assert.rejects(
      () => createBusinessPlan({ companyId: 'company_boundary_b', roundId: 'shoryokuka-ippan-7' }),
      /対象データが見つかりません/,
    )
    await assert.rejects(
      () => patchPlanSection('plan_boundary_b', 1, 'cross-user edit', 'edited'),
      /not found/,
    )
    await assert.rejects(
      () => exportPlan('plan_boundary_b', 'docx'),
      /not found/,
    )
    await assert.rejects(
      () => recommendExperts({ diagnosisId: 'diag_boundary_b', roundId: 'shoryokuka-ippan-7' }),
      /not found/,
    )
    await assert.rejects(
      () => createLead({ diagnosisId: 'diag_boundary_b', roundId: 'shoryokuka-ippan-7' }),
      /not found/,
    )
  } finally {
    resetServicePorts()
  }
})

serialTest('blocks redirects to private network addresses', async () => {
  await assert.rejects(
    () => validateRedirectLocation(new URL('https://example.com'), 'http://127.0.0.1/private'),
    /このURLは診断に利用できません/,
  )
})

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

function readDocxText(buffer) {
  const raw = buffer.toString('utf8')
  const documentXml = raw.match(/<w:document[\s\S]*<\/w:document>/)?.[0] || raw
  return decodeXml(documentXml
    .replace(/<\/w:p>/g, '\n')
    .replace(/<[^>]+>/g, ' '))
}

function readPdfText(filePath, buffer) {
  const structuralText = extractPdfUtf16Text(buffer)
  const readback = filePath
    ? spawnSync('pdftotext', ['-layout', filePath, '-'], { encoding: 'utf8' })
    : null
  if (readback && !readback.error && readback.status === 0 && readback.stdout.trim()) {
    return {
      method: 'pdftotext+structural',
      text: `${readback.stdout}\n${structuralText}`,
    }
  }
  return {
    method: 'structural',
    text: structuralText,
  }
}

function tokenFromUrl(fileUrl) {
  return new URL(fileUrl, 'http://local.invalid').searchParams.get('token')
}

async function confirmDraft(planId) {
  return confirmBusinessPlanDraft(planId, {
    draftResponsibility: true,
    sourceReview: true,
    noDelegatedFiling: true,
  })
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

function countPdfPages(buffer) {
  return buffer.toString('latin1').match(/\/Type \/Page\b/g)?.length || 0
}

function decodeXml(value) {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

let serialQueue = Promise.resolve()

function serialTest(name, fn) {
  test(name, async (t) => {
    const run = serialQueue.then(() => fn(t))
    serialQueue = run.catch(() => {})
    return run
  })
}
