import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { AUDIT_LOG_SCHEMA_VERSION, AUDIT_REDACTION_VALUE } from '../server/auditLogContract.mjs'
import {
  LocalMockStoreRepository,
  STORE_REPOSITORY_DOMAINS,
  STORE_REPOSITORY_METHODS,
} from '../server/storeRepository.mjs'

test('LocalMockStoreRepository implements the StoreRepository method contract', () => {
  const repository = new LocalMockStoreRepository()

  for (const method of STORE_REPOSITORY_METHODS) {
    assert.equal(typeof repository[method], 'function', `${method} should be implemented`)
  }
})

test('StoreRepository initial snapshot covers all Phase 1.5 persistence domains', async (t) => {
  const repository = await createTempRepository(t)
  const store = await repository.reset()

  assert.deepEqual(STORE_REPOSITORY_DOMAINS, [
    'users',
    'organizations',
    'organizationMemberships',
    'companies',
    'diagnoses',
    'matches',
    'applicantConfirmations',
    'plans',
    'exports',
    'notifications',
    'leads',
    'auditLogs',
    'ingestionRuns',
    'sourceRecords',
    'notificationSettings',
  ])

  for (const domain of ['users', 'organizations', 'organizationMemberships', 'companies', 'diagnoses', 'matches', 'applicantConfirmations', 'plans', 'exports', 'notifications', 'leads', 'auditLogs', 'ingestionRuns', 'sourceRecords']) {
    assert.ok(Array.isArray(store[domain]), `${domain} should be an array-backed domain`)
  }
  assert.equal(typeof store.notificationSettings, 'object')
  assert.ok(store.users[0].id)
  assert.ok(store.ingestionRuns[0].id)
  assert.equal(store.ingestionRuns[0].source, 'fixture')
  assert.ok(store.ingestionRuns[0].startedAt)
  assert.ok(store.ingestionRuns[0].finishedAt)

  const sourceRecord = store.sourceRecords[0]
  assert.ok(sourceRecord.id)
  assert.equal(sourceRecord.source, 'fixture')
  assert.ok(sourceRecord.externalId)
  assert.ok(sourceRecord.sourceUrl.startsWith('https://'))
  assert.match(sourceRecord.contentHash, /^[a-f0-9]{64}$/)
  assert.ok(sourceRecord.rawRef)
  assert.ok(sourceRecord.fetchedAt)

  const plan = { id: 'plan_contract_1', exports: [] }
  store.plans.push(plan)
  assert.ok(Array.isArray(store.plans[0].exports), 'exports are currently nested under plans[].exports')
})

test('StoreRepository appendAudit preserves traceability fields', async (t) => {
  const repository = await createTempRepository(t)
  await repository.reset()

  await repository.appendAudit(
    'diagnosis.viewed',
    { diagnosisId: 'diag_contract_1', contactEmail: 'owner@example.test' },
    { userId: 'user_contract_1', role: 'owner', organizationId: 'org_contract_1' },
    { correlationId: 'corr_contract_1' },
  )
  const store = await repository.load()
  const audit = store.auditLogs.at(-1)

  assert.equal(audit.id, 'audit_1')
  assert.equal(audit.schemaVersion, AUDIT_LOG_SCHEMA_VERSION)
  assert.equal(audit.userId, 'user_contract_1')
  assert.equal(audit.organizationId, 'org_contract_1')
  assert.deepEqual(audit.actor, {
    type: 'user',
    userId: 'user_contract_1',
    organizationId: 'org_contract_1',
    role: 'owner',
  })
  assert.equal(audit.event, 'diagnosis.viewed')
  assert.equal(audit.eventType, 'diagnosis.viewed')
  assert.deepEqual(audit.target, { type: 'diagnosis', id: 'diag_contract_1' })
  assert.equal(audit.targetType, 'diagnosis')
  assert.equal(audit.targetId, 'diag_contract_1')
  assert.deepEqual(audit.payload, { diagnosisId: 'diag_contract_1', contactEmail: AUDIT_REDACTION_VALUE })
  assert.equal(audit.correlationId, 'corr_contract_1')
  assert.match(audit.createdAt, /^\d{4}-\d{2}-\d{2}T/)
})

test('StoreRepository mutate serializes concurrent read-modify-write operations', async (t) => {
  const repository = await createTempRepository(t)
  await repository.reset()

  await Promise.all(Array.from({ length: 50 }, (_, index) =>
    repository.mutate((store) => {
      store.diagnoses.push({
        id: `contract_concurrent_${index}`,
        userId: 'user_contract_1',
        companyId: `company_contract_${index}`,
        status: 'done',
      })
    })))

  const store = await repository.load()
  assert.equal(store.diagnoses.filter((item) => item.id.startsWith('contract_concurrent_')).length, 50)
})

test('StoreRepository scoped reads only expose the current user data', async (t) => {
  const repository = await createTempRepository(t)
  await repository.reset()

  await repository.mutate((store) => {
    store.users.push({ id: 'user_a', email: 'a@example.test', role: 'owner' })
    store.users.push({ id: 'user_b', email: 'b@example.test', role: 'owner' })
    store.organizations.push(
      { id: 'org_a', name: 'A org' },
      { id: 'org_b', name: 'B org' },
    )
    store.organizationMemberships.push(
      { id: 'membership_a', userId: 'user_a', organizationId: 'org_a', role: 'owner' },
      { id: 'membership_b', userId: 'user_b', organizationId: 'org_b', role: 'owner' },
    )
    store.companies.push(
      { id: 'company_a', userId: 'user_a', profile: { name: 'A company' } },
      { id: 'company_b', userId: 'user_b', profile: { name: 'B company' } },
    )
    store.diagnoses.push(
      { id: 'diag_a', userId: 'user_a', companyId: 'company_a', events: [{ event: 'diagnosis.done' }] },
      { id: 'diag_b', userId: 'user_b', companyId: 'company_b', events: [{ event: 'diagnosis.done' }] },
    )
    store.matches.push(
      { id: 'match_a', userId: 'user_a', diagnosisId: 'diag_a', eligible: true, rank: 1 },
      { id: 'match_b', userId: 'user_b', diagnosisId: 'diag_b', eligible: true, rank: 1 },
    )
    store.plans.push(
      { id: 'plan_a', userId: 'user_a', companyId: 'company_a', exports: [{ fileUrl: '/exports/plan_a.docx', expiresAt: futureIso() }] },
      { id: 'plan_b', userId: 'user_b', companyId: 'company_b', exports: [{ fileUrl: '/exports/plan_b.docx', expiresAt: futureIso() }] },
    )
    store.leads.push(
      { id: 'lead_a', userId: 'user_a' },
      { id: 'lead_b', userId: 'user_b' },
    )
    store.auditLogs.push(
      { id: 'audit_a', userId: 'user_a', event: 'a' },
      { id: 'audit_b', userId: 'user_b', event: 'b' },
    )
  })

  const snapshot = await repository.loadUserSnapshot({ id: 'user_a' })
  assert.deepEqual(snapshot.users.map((item) => item.id), ['user_a'])
  assert.deepEqual(snapshot.organizations.map((item) => item.id), ['org_a'])
  assert.deepEqual(snapshot.organizationMemberships.map((item) => item.id), ['membership_a'])
  assert.deepEqual(snapshot.companies.map((item) => item.id), ['company_a'])
  assert.deepEqual(snapshot.diagnoses.map((item) => item.id), ['diag_a'])
  assert.deepEqual(snapshot.matches.map((item) => item.id), ['match_a'])
  assert.deepEqual(snapshot.plans.map((item) => item.id), ['plan_a'])
  assert.deepEqual(snapshot.leads.map((item) => item.id), ['lead_a'])
  assert.deepEqual(snapshot.auditLogs.map((item) => item.id), ['audit_a'])

  const diagnosisBundle = await repository.getDiagnosisBundleForUser({ id: 'user_a' }, 'diag_a')
  assert.equal(diagnosisBundle.company.id, 'company_a')
  assert.deepEqual(diagnosisBundle.matches.map((item) => item.id), ['match_a'])
  assert.equal(await repository.getDiagnosisBundleForUser({ id: 'user_b' }, 'diag_a'), null)

  const planBundle = await repository.getPlanBundleForUser({ id: 'user_a' }, 'plan_a')
  assert.equal(planBundle.company.id, 'company_a')
  assert.equal(await repository.getPlanBundleForUser({ id: 'user_b' }, 'plan_a'), null)

  const exportRecord = await repository.getExportRecordForUser({ id: 'user_a' }, 'plan_a.docx')
  assert.equal(exportRecord.planId, 'plan_a')
  assert.equal(await repository.getExportRecordForUser({ id: 'user_b' }, 'plan_a.docx'), null)
})

test('StoreRepository cleanupExpiredExports removes expired records and optional local files', async (t) => {
  const repository = await createTempRepository(t)
  const store = await repository.reset()
  const exportDir = path.dirname(repository.storePath)
  const expiredPath = path.join(exportDir, 'expired.docx')
  const activePath = path.join(exportDir, 'active.docx')
  await fs.writeFile(expiredPath, 'expired')
  await fs.writeFile(activePath, 'active')

  store.plans.push({
    id: 'plan_cleanup',
    userId: 'user_cleanup',
    exports: [
      { fileUrl: '/exports/expired.docx', filePath: expiredPath, expiresAt: '2026-06-20T00:00:00.000Z' },
      { fileUrl: '/exports/active.docx', filePath: activePath, expiresAt: '2099-01-01T00:00:00.000Z' },
    ],
  })
  await repository.save(store)

  const result = await repository.cleanupExpiredExports({
    now: '2026-06-20T00:00:01.000Z',
    deleteFiles: true,
  })
  const updated = await repository.load()

  assert.equal(result.removedCount, 1)
  assert.deepEqual(updated.plans[0].exports.map((item) => path.basename(item.filePath)), ['active.docx'])
  await assert.rejects(() => fs.stat(expiredPath), /ENOENT/)
  assert.equal((await fs.stat(activePath)).isFile(), true)
})

async function createTempRepository(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'hojokin-store-contract-'))
  t.after(() => fs.rm(dir, { recursive: true, force: true }))
  return new LocalMockStoreRepository({ storePath: path.join(dir, 'store.json') })
}

function futureIso() {
  return '2099-01-01T00:00:00.000Z'
}
