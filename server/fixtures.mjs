import { readFileSync } from 'node:fs'
import path from 'node:path'
import { subsidyRounds as fallbackSubsidyRounds } from './seedData.mjs'
import { buildSourceRefreshSummary } from './sourceRefresh.mjs'

const subsidyFixturePath = path.join(process.cwd(), 'data/fixtures/subsidy-programs.json')

export const activeSubsidyRounds = loadActiveSubsidyRounds()

function loadActiveSubsidyRounds() {
  try {
    const fixture = JSON.parse(readFileSync(subsidyFixturePath, 'utf8'))
    if (!Array.isArray(fixture.programs) || fixture.programs.length === 0) {
      return fallbackSubsidyRounds
    }
    const fixtureRounds = fixture.programs.map(normalizeSubsidyProgram)
    const publishedSeedRounds = loadPublishedSeedRounds()
    return dedupeRounds([...fixtureRounds, ...publishedSeedRounds])
  } catch {
    return fallbackSubsidyRounds
  }
}

function loadPublishedSeedRounds() {
  const runtimePath = process.env.RUNTIME_DIR
    ? path.resolve(process.env.RUNTIME_DIR)
    : path.join(process.cwd(), 'data/runtime')
  const publishedSeedPath = path.join(runtimePath, 'published-seed-rounds.json')
  try {
    const store = JSON.parse(readFileSync(publishedSeedPath, 'utf8'))
    if (store?.schema !== 'hojokin-pocket.published-seed-rounds.v1') return []
    if (store.userSideMatchingVisible !== true) return []
    if (!Array.isArray(store.programs)) return []
    return store.programs.map(normalizeSubsidyProgram)
  } catch {
    return []
  }
}

function normalizeSubsidyProgram(program) {
  const hardRules = Array.isArray(program.hardRules) ? program.hardRules : []
  const softRules = Array.isArray(program.softRules) ? program.softRules : []
  const requirements = [
    ...(Array.isArray(program.requirements) ? program.requirements : []),
    ...hardRules,
  ]
  const maxLimit = typeof program.maxLimit === 'object'
    ? Number(program.maxLimit.amountYen || 0)
    : Number(program.maxLimit || 0)
  const subsidyRate = typeof program.subsidyRate === 'object'
    ? program.subsidyRate.display
    : String(program.subsidyRate || '要確認')

  return {
    roundId: program.id,
    program: {
      id: slugId(program.program),
      name: program.program,
      issuer: program.issuer || '公式事務局',
      issuerType: 'official',
      overview: program.sourceNotes?.[0] || `${program.program}の公式情報に基づく開発用要約です。`,
      sourceUrl: program.sourceUrl,
    },
    roundLabel: program.round,
    status: normalizeStatus(program.status),
    acceptStart: dateValue(program.acceptStart),
    acceptStartLabel: dateLabel(program.acceptStart),
    acceptEnd: dateValue(program.acceptEnd),
    acceptEndLabel: dateLabel(program.acceptEnd),
    maxLimit,
    maxLimitLabel: program.maxLimit?.display || yen(maxLimit),
    subsidyRate,
    subsidyRateLabel: subsidyRate,
    adoptionRate: null,
    adoptionRateSource: null,
    lastSeenAt: toIsoDate(program.lastSeenAt),
    keywords: Array.isArray(program.keywords) ? program.keywords : [],
    requirements: [
      ...requirements.map((description) => ({
        kind: 'hard',
        label: firstSentence(description),
        result: 'needs_confirmation',
        description,
      })),
      ...softRules.map((description) => ({
        kind: 'soft',
        label: firstSentence(description),
        result: 'fit',
        description,
      })),
    ],
    requiredDocuments: (program.requiredDocuments || []).map((label) => ({
      label,
      aiDraftable: /計画|事業|経営/.test(label),
      checked: false,
    })),
    steps: [
      ...(program.hardRules || []).slice(0, 3),
      '公式サイトで申請手続きを確認',
      '本人確認後に必要書類を準備',
    ],
    evidence: program.evidence || [],
    sourceNotes: program.sourceNotes || [],
    sourceRecord: program.sourceRecord || null,
    sourceRefresh: buildSourceRefreshSummary(program, { today: process.env.SOURCE_REFRESH_TODAY }),
    rawFixtureId: program.id,
  }
}

function normalizeStatus(status) {
  if (status === 'open') return 'open'
  if (String(status || '').startsWith('closed')) return 'closed'
  return 'upcoming'
}

function dateValue(value) {
  if (!value || typeof value !== 'object') return value || null
  return value.value || null
}

function dateLabel(value) {
  if (!value || typeof value !== 'object') return value || null
  return value.display || value.value || null
}

function toIsoDate(value) {
  if (!value) return null
  return String(value).includes('T') ? value : `${value}T00:00:00+09:00`
}

function firstSentence(value) {
  return String(value || '').split(/[。.!?]/)[0].slice(0, 34) || '要確認'
}

function slugId(value) {
  return `program_${String(value || 'subsidy').replace(/[^\p{Letter}\p{Number}]+/gu, '_').replace(/^_|_$/g, '').slice(0, 40)}`
}

function yen(value) {
  return `¥${Number(value || 0).toLocaleString('en-US')}`
}

function dedupeRounds(rounds) {
  const byId = new Map()
  for (const round of rounds) {
    if (!round?.roundId || byId.has(round.roundId)) continue
    byId.set(round.roundId, round)
  }
  return Array.from(byId.values())
}
