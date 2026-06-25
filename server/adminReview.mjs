import { promises as fs } from 'node:fs'
import path from 'node:path'
import { buildSourceRefreshSummary, currentJstDate } from './sourceRefresh.mjs'
import { rootDir } from './utils.mjs'
import { DEFAULT_OUTPUT_PATH as seedDraftStorePath, readSeedDraftStore } from '../scripts/import-seed-draft-pack.mjs'

const subsidyFixturePath = path.join(rootDir, 'data/fixtures/subsidy-programs.json')
const expertPartnersPath = path.join(rootDir, 'data/fixtures/expert-partners.json')

export async function getAdminSourceReview(options = {}) {
  const [subsidyFixture, experts, seedDraftStore] = await Promise.all([
    readJson(subsidyFixturePath),
    readJson(expertPartnersPath),
    readSeedDraftStore(options.seedDraftStorePath || seedDraftStorePath),
  ])

  return buildAdminSourceReview({
    programs: subsidyFixture.programs || [],
    experts,
    seedDraftStore: options.seedDraftStore || seedDraftStore,
    today: options.today,
  })
}

export function buildAdminSourceReview({ programs = [], experts = [], seedDraftStore = null, today = currentJstDate() } = {}) {
  const subsidySources = programs.map((program) => summarizeSubsidySource(program, today))
  const expertCandidates = experts.map(summarizeExpertCandidate)
  const auditEvidence = programs.flatMap((program) => summarizeAuditEvidence(program))
  const draftSeed = summarizeDraftSeed(seedDraftStore)

  const missingEvidenceCount = subsidySources.filter((source) => !source.evidenceComplete).length
  const staleSubsidyCount = subsidySources.filter((source) => source.stale).length
  const expertMissingEvidenceCount = expertCandidates.filter((expert) => expert.missingFields.length > 0).length

  return {
    mode: 'read_only',
    scope: 'local_admin_source_review',
    generatedAt: new Date().toISOString(),
    reviewedDate: today,
    summary: {
      subsidyCount: subsidySources.length,
      expertCount: expertCandidates.length,
      auditEvidenceCount: auditEvidence.length,
      draftRoundCount: draftSeed.summary.roundDraftCount,
      draftReviewTaskCount: draftSeed.summary.reviewTaskCount,
      draftPublishableCount: draftSeed.summary.publishableCount,
      staleSubsidyCount,
      missingEvidenceCount,
      expertMissingEvidenceCount,
      warningsCount: staleSubsidyCount
        + missingEvidenceCount
        + expertMissingEvidenceCount
        + draftSeed.summary.reviewTaskCount,
    },
    caveat: '内部確認用の読み取り専用ビューです。公式サイトの最新情報、受任可否、報酬、対応範囲は必ず別途確認してください。',
    subsidySources,
    draftSeed,
    expertCandidates,
    auditEvidence,
  }
}

function summarizeSubsidySource(program, today) {
  const refresh = buildSourceRefreshSummary(program, { today })
  const missingFields = refresh.evidenceMissingFields || []
  const warnings = [
    refresh.warning,
    missingFields.length > 0
      ? `Evidence is missing for: ${missingFields.join(', ')}`
      : null,
  ].filter(Boolean)

  return {
    id: program.id,
    programName: program.program,
    roundLabel: program.round,
    issuer: program.issuer || null,
    status: program.status || null,
    statusGroup: refresh.statusGroup,
    sourceUrl: program.sourceUrl || refresh.sourceUrl || null,
    lastSeenAt: program.lastSeenAt || null,
    stale: refresh.stale,
    staleDays: refresh.staleDays,
    staleAfterDays: refresh.staleAfterDays,
    evidenceCount: refresh.evidenceSupport.count,
    evidenceComplete: refresh.evidenceSupport.complete,
    evidenceSupportedFields: refresh.evidenceSupportedFields,
    evidenceMissingFields: missingFields,
    contentHash: refresh.contentHash,
    previousContentHash: refresh.previousContentHash,
    contentHashChanged: refresh.contentHashChanged,
    sourceRecord: refresh.sourceRecord,
    gate: refresh.gate,
    sourceNotes: program.sourceNotes || [],
    warnings,
  }
}

function summarizeExpertCandidate(expert) {
  const missingFields = []
  if (!expert.sourceUrl) missingFields.push('sourceUrl')
  if (!expert.lastSeenAt) missingFields.push('lastSeenAt')
  if (!Array.isArray(expert.caveats) || expert.caveats.length === 0) missingFields.push('caveats')

  return {
    id: expert.id,
    name: expert.name,
    category: expert.category || null,
    serviceArea: expert.serviceArea || null,
    locations: expert.locations || [],
    websiteUrl: expert.websiteUrl || null,
    sourceUrl: expert.sourceUrl || null,
    sourceSummary: expert.sourceSummary || null,
    lastSeenAt: expert.lastSeenAt || null,
    verificationLevel: expert.verificationLevel || 'unverified',
    programFocus: expert.programFocus || [],
    strengthKeywords: expert.strengthKeywords || [],
    caveats: expert.caveats || [],
    missingFields,
  }
}

function summarizeAuditEvidence(program) {
  return (program.evidence || []).map((evidence, index) => ({
    id: `${program.id}:${index + 1}`,
    programId: program.id,
    programName: program.program,
    label: evidence.label || 'Evidence',
    url: evidence.url || null,
    sourceType: evidence.sourceType || null,
    observedAt: evidence.observedAt || null,
    supports: evidence.supports || [],
    note: evidence.note || null,
  }))
}

function summarizeDraftSeed(seedDraftStore) {
  if (!seedDraftStore) {
    return {
      available: false,
      packId: null,
      generatedAt: null,
      summary: {
        roundDraftCount: 0,
        programDraftCount: 0,
        reviewTaskCount: 0,
        sourceCount: 0,
        licenseReviewCount: 0,
        eligibilityDraftCount: 0,
        missingCriticalFieldCount: 0,
        publishableCount: 0,
        canonicalRoundWriteCount: 0,
      },
      roundDrafts: [],
      reviewTasks: [],
    }
  }

  const summary = seedDraftStore.summary || {}
  return {
    available: true,
    packId: seedDraftStore.pack?.id || null,
    generatedAt: seedDraftStore.generatedAt || null,
    mode: seedDraftStore.mode || null,
    mutation: seedDraftStore.mutation || null,
    userSideMatchingVisible: seedDraftStore.userSideMatchingVisible === true,
    summary: {
      roundDraftCount: Number(summary.roundDraftCount || 0),
      programDraftCount: Number(summary.programDraftCount || 0),
      reviewTaskCount: Number(summary.reviewTaskCount || 0),
      sourceCount: Number(summary.sourceCount || 0),
      licenseReviewCount: Number(summary.licenseReviewCount || 0),
      eligibilityDraftCount: Number(summary.eligibilityDraftCount || 0),
      missingCriticalFieldCount: Number(summary.missingCriticalFieldCount || 0),
      publishableCount: Number(summary.publishableCount || 0),
      canonicalRoundWriteCount: Number(summary.canonicalRoundWriteCount || 0),
    },
    roundDrafts: (seedDraftStore.subsidyRoundDrafts || []).slice(0, 50).map((round) => ({
      roundKey: round.roundKey,
      programName: round.programName,
      roundName: round.roundName,
      sourceId: round.sourceId,
      status: round.status,
      applicationEnd: round.applicationEnd,
      maxAmountYen: round.maxAmountYen,
      subsidyRate: round.subsidyRate,
      reviewStatus: round.reviewStatus,
      publishable: round.publishable === true,
      criticalMissingFields: round.criticalMissingFields || [],
      reviewTaskCount: Array.isArray(round.reviewTaskIds) ? round.reviewTaskIds.length : 0,
    })),
    reviewTasks: (seedDraftStore.sourceReviewTasks || []).slice(0, 50).map((task) => ({
      taskId: task.task_id,
      priority: task.priority,
      sourceId: task.source_id,
      programName: task.program_name,
      roundName: task.round_name,
      fieldName: task.field_name,
      reviewReason: task.review_reason,
      reviewStatus: task.review_status,
    })),
  }
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'))
}
