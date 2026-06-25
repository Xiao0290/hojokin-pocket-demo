import assert from 'node:assert/strict'
import test, { afterEach, beforeEach } from 'node:test'
import {
  configureServicePorts,
  createLead,
  exportPlan,
  getAdminSourceReview,
  getDiagnosis,
  getExportRecord,
  getMatches,
  getPlan,
  patchPlanSection,
  resetServicePorts,
  submitBusinessPlan,
} from '../server/services.mjs'
import { mutateStore, resetStore } from '../server/store.mjs'

const userA = { id: 'tenant_user_a', email: 'tenant-a@example.test', role: 'owner' }
const userB = { id: 'tenant_user_b', email: 'tenant-b@example.test', role: 'owner' }
const adminUser = { id: 'tenant_admin', email: 'admin@example.test', role: 'admin' }

beforeEach(async () => {
  resetServicePorts()
  await resetStore()
  await seedTenantRecords()
})

afterEach(() => {
  resetServicePorts()
})

test('service data reads and mutations do not cross user scope', async () => {
  useCurrentUser(userB)

  assert.equal(await getDiagnosis('tenant_diag_a'), null)
  assert.equal(await getMatches('tenant_diag_a'), null)
  assert.equal(await getPlan('tenant_plan_a'), null)
  assert.equal(await getExportRecord('tenant_plan_a.docx'), null)

  await assert.rejects(
    () => patchPlanSection('tenant_plan_a', 1, 'cross tenant edit'),
    (error) => error.code === 'NOT_FOUND' && error.status === 404,
  )
  await assert.rejects(
    () => exportPlan('tenant_plan_a', 'docx'),
    (error) => error.code === 'NOT_FOUND' && error.status === 404,
  )
  await assert.rejects(
    () => submitBusinessPlan('tenant_plan_a', { mode: 'cross-tenant' }),
    (error) => error.code === 'NOT_FOUND' && error.status === 404,
  )
  await assert.rejects(
    () => createLead({ diagnosisId: 'tenant_diag_a', roundId: 'shoryokuka-ippan-7' }),
    (error) => error.code === 'NOT_FOUND' && error.status === 404,
  )

  assert.equal((await getDiagnosis('tenant_diag_b')).id, 'tenant_diag_b')
  assert.equal((await getPlan('tenant_plan_b')).id, 'tenant_plan_b')
  assert.equal((await getExportRecord('tenant_plan_b.docx')).planId, 'tenant_plan_b')
})

test('admin source-review service is role-gated', async () => {
  useCurrentUser(userA)
  await assert.rejects(
    () => getAdminSourceReview({ today: '2026-06-20' }),
    (error) => error.code === 'FORBIDDEN' && error.status === 403,
  )

  useCurrentUser(adminUser)
  const review = await getAdminSourceReview({ today: '2026-06-20' })
  assert.equal(review.mode, 'read_only')
  assert.equal(review.scope, 'local_admin_source_review')
  assert.ok(review.summary.subsidyCount > 0)
})

async function seedTenantRecords() {
  await mutateStore((store) => {
    store.users.push(userA, userB, adminUser)
    store.organizations.push(
      { id: 'tenant_org_a', name: 'Tenant A' },
      { id: 'tenant_org_b', name: 'Tenant B' },
    )
    store.organizationMemberships.push(
      { id: 'tenant_membership_a', userId: userA.id, organizationId: 'tenant_org_a', role: 'owner' },
      { id: 'tenant_membership_b', userId: userB.id, organizationId: 'tenant_org_b', role: 'owner' },
      { id: 'tenant_membership_admin', userId: adminUser.id, organizationId: 'tenant_org_a', role: 'admin' },
    )
    store.companies.push(
      {
        id: 'tenant_company_a',
        userId: userA.id,
        name: 'Tenant Company A',
        profile: { name: 'Tenant Company A', keywords: ['省力化'], citations: [], unknowns: [] },
      },
      {
        id: 'tenant_company_b',
        userId: userB.id,
        name: 'Tenant Company B',
        profile: { name: 'Tenant Company B', keywords: ['AI'], citations: [], unknowns: [] },
      },
    )
    store.diagnoses.push(
      {
        id: 'tenant_diag_a',
        userId: userA.id,
        companyId: 'tenant_company_a',
        status: 'done',
        events: [{ event: 'diagnosis.done', data: {}, createdAt: '2026-06-20T00:00:00.000Z' }],
      },
      {
        id: 'tenant_diag_b',
        userId: userB.id,
        companyId: 'tenant_company_b',
        status: 'done',
        events: [{ event: 'diagnosis.done', data: {}, createdAt: '2026-06-20T00:00:00.000Z' }],
      },
    )
    store.matches.push(
      {
        id: 'tenant_match_a',
        userId: userA.id,
        diagnosisId: 'tenant_diag_a',
        roundId: 'shoryokuka-ippan-7',
        eligible: true,
        rank: 1,
        maxLimit: 80000000,
      },
      {
        id: 'tenant_match_b',
        userId: userB.id,
        diagnosisId: 'tenant_diag_b',
        roundId: 'shoryokuka-ippan-7',
        eligible: true,
        rank: 1,
        maxLimit: 80000000,
      },
    )
    store.plans.push(
      makePlan({ id: 'tenant_plan_a', userId: userA.id, companyId: 'tenant_company_a', filename: 'tenant_plan_a.docx' }),
      makePlan({ id: 'tenant_plan_b', userId: userB.id, companyId: 'tenant_company_b', filename: 'tenant_plan_b.docx' }),
    )
  })
}

function makePlan({ id, userId, companyId, filename }) {
  return {
    id,
    userId,
    companyId,
    roundId: 'shoryokuka-ippan-7',
    status: 'draft',
    sections: [
      {
        chapterNo: 1,
        heading: 'Tenant section',
        body: 'Tenant scoped body',
        status: 'ai_draft',
        revision: 1,
        charCount: 18,
      },
    ],
    exports: [
      {
        format: 'docx',
        fileUrl: `/exports/${filename}`,
        expiresAt: '2099-01-01T00:00:00.000Z',
        createdAt: '2026-06-20T00:00:00.000Z',
      },
    ],
    events: [],
    createdAt: '2026-06-20T00:00:00.000Z',
    updatedAt: '2026-06-20T00:00:00.000Z',
  }
}

function useCurrentUser(user) {
  configureServicePorts({
    AuthProvider: {
      currentUser: () => user,
    },
  })
}
