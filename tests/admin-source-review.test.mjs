import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { buildAdminSourceReview, getAdminSourceReview } from '../server/adminReview.mjs'
import { buildSeedDraftStore } from '../scripts/import-seed-draft-pack.mjs'

const fixture = JSON.parse(readFileSync('data/fixtures/subsidy-programs.json', 'utf8'))
const experts = JSON.parse(readFileSync('data/fixtures/expert-partners.json', 'utf8'))

test('admin source review lists subsidy sources, expert candidates, and audit evidence', async () => {
  const review = await getAdminSourceReview({ today: '2026-06-20' })

  assert.equal(review.mode, 'read_only')
  assert.equal(review.scope, 'local_admin_source_review')
  assert.equal(review.summary.subsidyCount, fixture.programs.length)
  assert.equal(review.summary.expertCount, experts.length)
  assert.ok(review.summary.auditEvidenceCount > 0)

  const subsidy = review.subsidySources.find((item) => item.id === 'jizokuka-normal-20')
  assert.equal(subsidy.sourceUrl, 'https://official.jizokukanb.com/shinsei')
  assert.equal(subsidy.lastSeenAt, '2026-06-20')
  assert.equal(subsidy.evidenceComplete, true)
  assert.equal(subsidy.sourceRecord.licenseStatus, 'restricted')

  const expert = review.expertCandidates.find((item) => item.id === 'expert_aoi_gyosei')
  assert.ok(expert.sourceUrl.startsWith('https://'))
  assert.equal(expert.lastSeenAt, '2026-06-20T00:00:00+09:00')
  assert.ok(expert.caveats.length >= 2)
})

test('admin source review surfaces stale subsidy records and missing evidence fields', () => {
  const staleProgram = {
    ...fixture.programs[0],
    id: 'stale-missing-source',
    lastSeenAt: '2026-06-01',
    evidence: [
      {
        label: 'Incomplete source page',
        url: 'https://example.test/source',
        observedAt: '2026-06-01',
        supports: ['sourceUrl', 'status'],
      },
    ],
    sourceRecord: {
      ...fixture.programs[0].sourceRecord,
      contentHash: null,
      staleAfterDays: 14,
    },
  }
  const incompleteExpert = {
    id: 'expert_incomplete',
    name: '未確認専門家',
    category: '行政書士',
    serviceArea: '未確認',
    caveats: [],
  }

  const review = buildAdminSourceReview({
    programs: [staleProgram],
    experts: [incompleteExpert],
    today: '2026-06-20',
  })

  assert.equal(review.summary.staleSubsidyCount, 1)
  assert.equal(review.summary.missingEvidenceCount, 1)
  assert.equal(review.summary.expertMissingEvidenceCount, 1)
  assert.equal(review.summary.warningsCount, 3)

  assert.equal(review.subsidySources[0].stale, true)
  assert.equal(review.subsidySources[0].evidenceComplete, false)
  assert.ok(review.subsidySources[0].evidenceMissingFields.includes('maxLimit'))
  assert.ok(review.subsidySources[0].warnings.some((warning) => warning.includes('Evidence is missing')))
  assert.deepEqual(review.expertCandidates[0].missingFields, ['sourceUrl', 'lastSeenAt', 'caveats'])
})

test('admin source review exposes seed drafts as unpublished review queue only', async () => {
  const seedDraftStore = await buildSeedDraftStore({ generatedAt: '2026-06-20T00:00:00.000Z' })
  const review = buildAdminSourceReview({
    programs: fixture.programs,
    experts,
    seedDraftStore,
    today: '2026-06-20',
  })

  assert.equal(review.draftSeed.available, true)
  assert.equal(review.summary.draftRoundCount, 33)
  assert.equal(review.summary.draftReviewTaskCount, 84)
  assert.equal(review.summary.draftPublishableCount, 0)
  assert.equal(review.draftSeed.summary.canonicalRoundWriteCount, 0)
  assert.equal(review.draftSeed.userSideMatchingVisible, false)
  assert.ok(review.draftSeed.roundDrafts.every((round) => round.publishable === false))
  assert.ok(review.draftSeed.roundDrafts.some((round) => round.criticalMissingFields.length > 0))
})
