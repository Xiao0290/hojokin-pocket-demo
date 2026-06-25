import { DISCLAIMER } from './seedData.mjs'

export const PLAN_TEMPLATE_VERSION = 'subsidy-plan-template.v1'

const BASE_CONFIRMATION_FLAGS = Object.freeze([
  '従業員数',
  '資本金',
  '所在地',
  '投資予定額',
  '見積状況',
  'GビズIDプライム',
])

const PLAN_TEMPLATES = Object.freeze([
  {
    id: 'labor-saving',
    category: 'labor_saving',
    name: '省力化投資テンプレート',
    matcher: /省力化|人手不足|IoT|ロボット|センサー|専用設備/i,
    focus: '人手不足の業務、代替する作業、導入後の省力化効果を中心に整理します。',
    investmentLabel: '省力化設備・システム構築・関連導入費',
    outcomeLabel: '作業時間、人員配置、繁忙期対応、サービス品質の改善',
    confirmationFlags: ['人手不足を示す資料', '導入設備の仕様', '給与支給総額の確認書'],
  },
  {
    id: 'capital-investment',
    category: 'equipment',
    name: '設備投資・新製品開発テンプレート',
    matcher: /ものづくり|新製品|新サービス|生産性|海外展開|高付加価値/i,
    focus: '設備投資と新製品・新サービスの革新性を中心に整理します。',
    investmentLabel: '機械装置・システム・外注・試作費',
    outcomeLabel: '付加価値額、生産能力、品質、賃上げ計画との関係',
    confirmationFlags: ['設備仕様', '見積書・仕様書', '賃金引上げ計画', '労働者名簿'],
  },
  {
    id: 'market-development',
    category: 'market_development',
    name: '販路開拓・経営計画テンプレート',
    matcher: /持続化|販路|広告|Webサイト|展示会|新商品|経営計画/i,
    focus: '販路開拓施策、顧客導線、商工会・商工会議所との確認事項を中心に整理します。',
    investmentLabel: '広告・Web・展示会・新商品開発費',
    outcomeLabel: '問い合わせ数、商談数、売上拡大、リピート導線の改善',
    confirmationFlags: ['経営計画', '補助事業計画', '事業支援計画書（様式4）'],
  },
  {
    id: 'succession-ma',
    category: 'succession',
    name: '事業承継・M&A準備テンプレート',
    matcher: /承継|M&A|PMI|後継者|廃業|再チャレンジ/i,
    focus: '承継・M&Aの事実関係、引継ぐ経営資源、実施体制を中心に整理します。',
    investmentLabel: '承継後の設備投資・PMI・専門家活用費',
    outcomeLabel: '雇用維持、経営資源活用、承継後の成長計画',
    confirmationFlags: ['承継予定', 'M&A類型別資料', '認定支援機関確認書'],
  },
  {
    id: 'digital-tool',
    category: 'digital',
    name: 'IT・AI導入準備テンプレート',
    matcher: /IT導入|ITツール|デジタル|AI導入|DX|クラウド|販売管理|会計|ホテル管理/i,
    focus: '導入するITツール、対象業務、業務プロセスの変化を中心に整理します。',
    investmentLabel: 'ITツール・クラウド・AI導入費',
    outcomeLabel: '処理時間、入力ミス、予約・会計・販売管理の改善',
    confirmationFlags: ['導入予定ITツール', 'IT導入支援事業者', 'SECURITY ACTION自己宣言'],
  },
])

const FALLBACK_TEMPLATE = Object.freeze({
  id: 'general-preparation',
  category: 'general',
  name: '汎用下書き準備テンプレート',
  matcher: /$a/,
  focus: '公開情報と制度要件を照合し、本人確認が必要な項目を中心に整理します。',
  investmentLabel: '対象経費',
  outcomeLabel: '売上、作業時間、顧客体験などの改善',
  confirmationFlags: [],
})

export function listPlanTemplates() {
  return [...PLAN_TEMPLATES, FALLBACK_TEMPLATE].map(publicTemplate)
}

export function selectPlanTemplate(round = {}) {
  const haystack = [
    round.roundId,
    round.program?.name,
    round.roundLabel,
    round.program?.overview,
    ...(round.keywords || []),
    ...(round.requiredDocuments || []).map((document) => document.label || document),
  ].join(' ')
  const template = PLAN_TEMPLATES.find((candidate) => candidate.matcher.test(haystack)) || FALLBACK_TEMPLATE
  return publicTemplate(template)
}

export function buildPlanSectionsLocalMock(profile, round, options = {}) {
  const template = selectPlanTemplate(round)
  const companyName = profile?.name || '当社'
  const summary = profile?.businessSummary || '公開情報から確認できた事業内容をもとに整理します。'
  const overview = summary.startsWith(companyName) ? summary : `${companyName}は、${summary}`
  const sourceReferences = buildPlanSourceReferences(profile, round)
  const requiredDocumentChecklist = buildRequiredDocumentChecklist(round)
  const confirmationFlags = buildPlanConfirmationFlags(profile, round, template)
  const targetChars = Number(options.targetChars || 0)

  const sections = [
    {
      chapterNo: 1,
      heading: '事業概要',
      body: [
        `${overview}`,
        `${template.name}を使い、${template.focus}`,
        `公開情報で確認できたキーワード: ${compactList(profile?.keywords).join('、') || '要確認'}。`,
      ].join('\n'),
      status: 'ai_draft',
      sources: profile?.citations || [],
      needsConfirmation: false,
      confirmationFlags: [],
      requiredDocumentRefs: [],
    },
    {
      chapterNo: 2,
      heading: '課題と投資の必要性',
      body: [
        `${round.program.name}の目的に合わせ、${template.investmentLabel}を使う理由を整理します。`,
        `${template.focus}`,
        '従業員数、資本金、所在地、投資予定額、見積状況は本人確認が必要です。',
      ].join('\n'),
      status: 'needs_confirmation',
      sources: sourceReferences,
      needsConfirmation: true,
      confirmationFlags: confirmationFlags.slice(0, 6),
      requiredDocumentRefs: requiredDocumentChecklist.slice(0, 4).map((item) => item.label),
    },
    {
      chapterNo: 3,
      heading: '実施内容',
      body: [
        `${round.roundLabel}で想定される対象経費を踏まえ、${template.investmentLabel}の候補を整理します。`,
        `必要書類候補: ${requiredDocumentChecklist.slice(0, 5).map((item) => item.label).join('、') || '公式ページで確認'}。`,
        '対象経費と補助対象外経費は、公式公募要領で確認してください。',
      ].join('\n'),
      status: 'ai_draft',
      sources: sourceReferences,
      needsConfirmation: false,
      confirmationFlags: confirmationFlags.filter((item) => /見積|仕様|書類|ツール|設備/.test(item)),
      requiredDocumentRefs: requiredDocumentChecklist.slice(0, 6).map((item) => item.label),
    },
    {
      chapterNo: 4,
      heading: '効果見込み',
      body: [
        `${template.outcomeLabel}を、確認可能な数値に置き換えて整理します。`,
        '根拠のない数値は提出前に削除または修正してください。',
        targetChars >= 8000
          ? '長文出力では、効果指標ごとに現状値、目標値、確認資料を分けて追記します。'
          : '現時点では定性的な仮説として置き、本人確認後に数値を補います。',
      ].join('\n'),
      status: 'needs_confirmation',
      sources: sourceReferences,
      needsConfirmation: true,
      confirmationFlags: ['現状値', '目標値', '数値根拠', ...(template.confirmationFlags || [])].slice(0, 6),
      requiredDocumentRefs: requiredDocumentChecklist
        .filter((item) => /賃金|給与|計画|決算|確認|資料/.test(item.label))
        .slice(0, 5)
        .map((item) => item.label),
    },
    {
      chapterNo: 5,
      heading: '確認事項・必要書類',
      body: [
        `${DISCLAIMER}`,
        `テンプレート: ${template.name}`,
        `本人確認が必要な項目: ${confirmationFlags.join('、') || '公式要件'}`,
        `必要書類: ${requiredDocumentChecklist.map((item) => item.label).join('、') || '公式ページで確認'}`,
      ].join('\n'),
      status: 'needs_confirmation',
      sources: sourceReferences,
      needsConfirmation: true,
      confirmationFlags,
      requiredDocumentRefs: requiredDocumentChecklist.map((item) => item.label),
    },
  ]

  return sections.map((section) => ({
    ...section,
    templateId: template.id,
    templateName: template.name,
    templateCategory: template.category,
    charCount: section.body.length,
    revision: 1,
  }))
}

export function buildRequiredDocumentChecklist(round = {}) {
  return (round.requiredDocuments || []).map((document, index) => {
    const label = document.label || String(document)
    return {
      id: `doc_${index + 1}`,
      label,
      aiDraftable: Boolean(document.aiDraftable),
      checked: Boolean(document.checked),
      source: 'round.requiredDocuments',
      needsApplicantConfirmation: true,
    }
  })
}

export function buildPlanSourceReferences(profile = {}, round = {}) {
  const sources = []
  for (const citation of profile?.citations || []) {
    if (citation?.url) {
      sources.push({
        url: citation.url,
        label: citation.label || '会社公式サイト',
        type: 'company',
      })
    }
  }
  if (round.program?.sourceUrl) {
    sources.push({
      url: round.program.sourceUrl,
      label: '制度公式ページ',
      type: 'subsidy',
      lastSeenAt: round.lastSeenAt || null,
    })
  }
  for (const evidence of round.evidence || []) {
    if (evidence?.url) {
      sources.push({
        url: evidence.url,
        label: evidence.label || '制度根拠資料',
        type: evidence.sourceType || 'evidence',
        lastSeenAt: evidence.observedAt || round.lastSeenAt || null,
      })
    }
  }
  return dedupeSources(sources).slice(0, 6)
}

export function buildPlanConfirmationFlags(profile = {}, round = {}, template = selectPlanTemplate(round)) {
  const fromUnknowns = profile?.unknowns || []
  const fromRequirements = (round.requirements || [])
    .filter((requirement) => requirement.result === 'needs_confirmation' || requirement.kind === 'hard')
    .map((requirement) => requirement.label)
  const fromDocuments = (round.requiredDocuments || [])
    .map((document) => document.label || String(document))
    .filter((label) => /GビズID|見積|確認|計画|決算|証明|資料|名簿|支援/.test(label))

  return unique([
    ...BASE_CONFIRMATION_FLAGS,
    ...(template.confirmationFlags || []),
    ...fromUnknowns,
    ...fromRequirements,
    ...fromDocuments,
  ]).slice(0, 16)
}

function publicTemplate(template) {
  return {
    id: template.id,
    category: template.category,
    name: template.name,
    version: PLAN_TEMPLATE_VERSION,
    focus: template.focus,
    investmentLabel: template.investmentLabel,
    outcomeLabel: template.outcomeLabel,
    confirmationFlags: [...(template.confirmationFlags || [])],
  }
}

function compactList(values = []) {
  return unique(values.filter(Boolean)).slice(0, 8)
}

function unique(values = []) {
  return Array.from(new Set(values.map((value) => String(value || '').trim()).filter(Boolean)))
}

function dedupeSources(sources) {
  const seen = new Set()
  return sources.filter((source) => {
    const key = `${source.type || ''}:${source.url || ''}:${source.label || ''}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
