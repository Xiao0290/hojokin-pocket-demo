import assert from 'node:assert/strict'
import test from 'node:test'
import { AUDIT_LOG_SCHEMA_VERSION, AUDIT_REDACTION_VALUE } from '../server/auditLogContract.mjs'
import {
  LocalMockStoreRepository,
  createStoreRepositoryForBackend,
  storeBackendFromEnv,
} from '../server/storeRepository.mjs'
import { PostgresStoreRepository, assertPostgresRuntimeConfig } from '../server/postgresStoreRepository.mjs'

test('store backend selection keeps local as default and fails fast for incomplete postgres config', async () => {
  assert.equal(storeBackendFromEnv({}), 'local')
  assert.ok(createStoreRepositoryForBackend({ STORE_BACKEND: 'local' }) instanceof LocalMockStoreRepository)

  assert.throws(
    () => createStoreRepositoryForBackend({ STORE_BACKEND: 'postgres' }),
    /DATABASE_URL is required/,
  )
  assert.throws(
    () => assertPostgresRuntimeConfig({ STORE_BACKEND: 'postgres' }),
    /DATABASE_URL is required/,
  )
  assert.throws(
    () => createStoreRepositoryForBackend({ STORE_BACKEND: 'mysql' }),
    /Unsupported STORE_BACKEND/,
  )
})

test('PostgresStoreRepository loads relational rows into the existing store shape with tenant scope', async () => {
  const client = new FakePgClient(fakeRows())
  const repository = new PostgresStoreRepository({ client })
  const store = await repository.load()

  assert.deepEqual(store.users.map((user) => user.id), ['user_a', 'user_b'])
  assert.deepEqual(store.companies.map((company) => company.id), ['company_a', 'company_b'])
  assert.equal(store.diagnoses[0].inputUrl, 'https://a.example/')
  assert.equal(store.matches[0].maxLimit, 80000000)
  assert.equal(store.plans[0].exports[0].fileUrl, '/exports/plan_a.docx')
  assert.equal(store.plans[0].exports[0].filename, 'plan_a.docx')
  assert.equal(store.plans[0].exports[0].mimeType, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
  assert.equal(store.plans[0].exports[0].sizeBytes, 128)
  assert.match(store.plans[0].exports[0].checksum, /^[a-f0-9]{64}$/)
  assert.equal(store.auditLogs[0].schemaVersion, AUDIT_LOG_SCHEMA_VERSION)
  assert.equal(store.auditLogs[0].eventType, 'diagnosis.viewed')
  assert.deepEqual(store.auditLogs[0].target, { type: 'diagnosis', id: 'diag_a' })
  assert.equal(store.notificationSettings.push, true)
  assert.ok(client.sqlLog.some((sql) => /FROM users/i.test(sql)))
  assert.ok(client.sqlLog.some((sql) => /FROM source_records/i.test(sql)))

  const snapshot = await repository.loadUserSnapshot({ id: 'user_a' })
  assert.deepEqual(snapshot.users.map((user) => user.id), ['user_a'])
  assert.deepEqual(snapshot.companies.map((company) => company.id), ['company_a'])
  assert.deepEqual(snapshot.diagnoses.map((diagnosis) => diagnosis.id), ['diag_a'])
  assert.deepEqual(snapshot.matches.map((match) => match.id), ['match_a'])
  assert.deepEqual(snapshot.plans.map((plan) => plan.id), ['plan_a'])
  assert.deepEqual(snapshot.leads.map((lead) => lead.id), ['lead_a'])

  const diagnosisBundle = await repository.getDiagnosisBundleForUser({ id: 'user_a' }, 'diag_a')
  assert.equal(diagnosisBundle.company.id, 'company_a')
  assert.deepEqual(diagnosisBundle.matches.map((match) => match.id), ['match_a'])
  assert.equal(await repository.getDiagnosisBundleForUser({ id: 'user_b' }, 'diag_a'), null)

  const planBundle = await repository.getPlanBundleForUser({ id: 'user_a' }, 'plan_a')
  assert.equal(planBundle.company.id, 'company_a')
  assert.equal(await repository.getPlanBundleForUser({ id: 'user_b' }, 'plan_a'), null)

  const exportRecord = await repository.getExportRecordForUser({ id: 'user_a' }, 'plan_a.docx')
  assert.equal(exportRecord.planId, 'plan_a')
  assert.equal(await repository.getExportRecordForUser({ id: 'user_b' }, 'plan_a.docx'), null)
})

test('PostgresStoreRepository reset and appendAudit use explicit SQL boundaries', async () => {
  const client = new FakePgClient(fakeRows())
  const repository = new PostgresStoreRepository({ client, initialStore: postgresSeedStore })

  await repository.reset()
  assert.ok(client.sqlLog.includes('BEGIN'))
  assert.ok(client.sqlLog.includes('COMMIT'))
  assert.ok(client.sqlLog.some((sql) => /DELETE FROM users/i.test(sql)))
  assert.ok(client.sqlLog.some((sql) => /INSERT INTO source_records/i.test(sql)))
  assert.ok(client.sqlLog.some((sql) => /INSERT INTO subsidy_rounds/i.test(sql)))

  await repository.appendAudit(
    'diagnosis.viewed',
    { diagnosisId: 'diag_a', contactEmail: 'owner@example.test' },
    { userId: 'user_a', role: 'owner', organizationId: 'org_a' },
    { correlationId: 'corr_pg_contract' },
  )
  const auditCall = client.calls.find((call) => /INSERT INTO audit_logs/i.test(call.sql) && call.params[4] === 'diagnosis.viewed')
  assert.ok(auditCall)
  assert.equal(auditCall.params[1], 'user_a')
  assert.equal(auditCall.params[2], 'org_a')
  assert.equal(auditCall.params[3], 'user')
  assert.equal(auditCall.params[5], 'diagnosis')
  assert.equal(auditCall.params[6], 'diag_a')
  assert.equal(auditCall.params[8], 'corr_pg_contract')
  assert.equal(JSON.parse(auditCall.params[7]).contactEmail, AUDIT_REDACTION_VALUE)
})

class FakePgClient {
  constructor(rowsByTable) {
    this.rowsByTable = rowsByTable
    this.calls = []
    this.sqlLog = []
  }

  async query(sql, params = []) {
    const normalized = String(sql).replace(/\s+/g, ' ').trim()
    this.calls.push({ sql: normalized, params })
    this.sqlLog.push(normalized)
    if (/^SELECT\b/i.test(normalized)) {
      return { rows: this.selectRows(normalized) }
    }
    return { rows: [] }
  }

  selectRows(sql) {
    if (/FROM users\b/i.test(sql)) return this.rowsByTable.users
    if (/FROM organizations\b/i.test(sql)) return this.rowsByTable.organizations
    if (/FROM organization_memberships\b/i.test(sql)) return this.rowsByTable.organization_memberships
    if (/FROM companies\b/i.test(sql)) return this.rowsByTable.companies
    if (/FROM diagnoses\b/i.test(sql)) return this.rowsByTable.diagnoses
    if (/FROM subsidy_matches\b/i.test(sql)) return this.rowsByTable.subsidy_matches
    if (/FROM applicant_confirmations\b/i.test(sql)) return this.rowsByTable.applicant_confirmations
    if (/FROM business_plans\b/i.test(sql)) return this.rowsByTable.business_plans
    if (/FROM exported_files\b/i.test(sql)) return this.rowsByTable.exported_files
    if (/FROM consent_records\b/i.test(sql)) return this.rowsByTable.consent_records
    if (/FROM lead_requests\b/i.test(sql)) return this.rowsByTable.lead_requests
    if (/FROM audit_logs\b/i.test(sql)) return this.rowsByTable.audit_logs
    if (/FROM source_extraction_runs\b/i.test(sql)) return this.rowsByTable.source_extraction_runs
    if (/FROM source_records\b/i.test(sql)) return this.rowsByTable.source_records
    if (/FROM notification_settings\b/i.test(sql)) return this.rowsByTable.notification_settings
    return []
  }
}

function fakeRows() {
  return {
    users: [
      { id: 'user_a', email: 'a@example.test', display_name: 'User A', role: 'owner', created_at: iso(1), updated_at: iso(2) },
      { id: 'user_b', email: 'b@example.test', display_name: 'User B', role: 'owner', created_at: iso(1), updated_at: iso(2) },
    ],
    organizations: [
      { id: 'org_a', name: 'A org', created_at: iso(1), updated_at: iso(2) },
      { id: 'org_b', name: 'B org', created_at: iso(1), updated_at: iso(2) },
    ],
    organization_memberships: [
      { id: 'membership_a', user_id: 'user_a', organization_id: 'org_a', role: 'owner', created_at: iso(1) },
      { id: 'membership_b', user_id: 'user_b', organization_id: 'org_b', role: 'owner', created_at: iso(1) },
    ],
    companies: [
      { id: 'company_a', user_id: 'user_a', organization_id: 'org_a', url: 'https://a.example/', name: 'A company', prefecture: null, city: null, profile_json: { name: 'A company', citations: [], unknowns: [] }, citations_json: [], unknowns_json: [], created_at: iso(1), updated_at: iso(2) },
      { id: 'company_b', user_id: 'user_b', organization_id: 'org_b', url: 'https://b.example/', name: 'B company', prefecture: null, city: null, profile_json: { name: 'B company', citations: [], unknowns: [] }, citations_json: [], unknowns_json: [], created_at: iso(1), updated_at: iso(2) },
    ],
    diagnoses: [
      { id: 'diag_a', user_id: 'user_a', organization_id: 'org_a', company_id: 'company_a', status: 'done', progress: 100, events_json: [{ event: 'diagnosis.done' }], result_json: { inputUrl: 'https://a.example/', matchCount: 1, totalLimit: 80000000 }, created_at: iso(1), updated_at: iso(2) },
      { id: 'diag_b', user_id: 'user_b', organization_id: 'org_b', company_id: 'company_b', status: 'done', progress: 100, events_json: [{ event: 'diagnosis.done' }], result_json: { inputUrl: 'https://b.example/', matchCount: 1, totalLimit: 500000 }, created_at: iso(1), updated_at: iso(2) },
    ],
    subsidy_matches: [
      { id: 'match_a', user_id: 'user_a', organization_id: 'org_a', diagnosis_id: 'diag_a', round_id: 'shoryokuka-ippan-7', rank: 1, score: 90, eligible: true, reasons_json: ['省力化'], warnings_json: [], provenance_json: { maxLimit: 80000000 }, created_at: iso(2) },
      { id: 'match_b', user_id: 'user_b', organization_id: 'org_b', diagnosis_id: 'diag_b', round_id: 'jizokuka-18', rank: 1, score: 60, eligible: true, reasons_json: ['販路'], warnings_json: [], provenance_json: { maxLimit: 500000 }, created_at: iso(2) },
    ],
    applicant_confirmations: [],
    business_plans: [
      { id: 'plan_a', user_id: 'user_a', organization_id: 'org_a', company_id: 'company_a', diagnosis_id: 'diag_a', round_id: 'shoryokuka-ippan-7', status: 'draft', provenance_json: {}, sections_json: [{ chapterNo: 1, heading: 'A', body: 'A', revision: 1 }], created_at: iso(2), updated_at: iso(3) },
      { id: 'plan_b', user_id: 'user_b', organization_id: 'org_b', company_id: 'company_b', diagnosis_id: 'diag_b', round_id: 'jizokuka-18', status: 'draft', provenance_json: {}, sections_json: [{ chapterNo: 1, heading: 'B', body: 'B', revision: 1 }], created_at: iso(2), updated_at: iso(3) },
    ],
    exported_files: [
      { id: 'export_a', user_id: 'user_a', organization_id: 'org_a', plan_id: 'plan_a', format: 'docx', storage_key: 'plan_a.docx', filename: 'plan_a.docx', mime_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', size_bytes: 128, checksum: 'a'.repeat(64), file_url: '/exports/plan_a.docx', disclaimer_text: 'AI下書き', expires_at: '2099-01-01T00:00:00.000Z', created_at: iso(3) },
      { id: 'export_b', user_id: 'user_b', organization_id: 'org_b', plan_id: 'plan_b', format: 'docx', storage_key: 'plan_b.docx', filename: 'plan_b.docx', mime_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', size_bytes: 128, checksum: 'b'.repeat(64), file_url: '/exports/plan_b.docx', disclaimer_text: 'AI下書き', expires_at: '2099-01-01T00:00:00.000Z', created_at: iso(3) },
    ],
    consent_records: [],
    lead_requests: [
      { id: 'lead_a', user_id: 'user_a', organization_id: 'org_a', expert_id: 'expert_a', round_id: 'shoryokuka-ippan-7', status: 'waitlisted', consent_record_id: null, payload_json: { message: 'A' }, created_at: iso(3), updated_at: iso(3) },
      { id: 'lead_b', user_id: 'user_b', organization_id: 'org_b', expert_id: 'expert_b', round_id: 'jizokuka-18', status: 'waitlisted', consent_record_id: null, payload_json: { message: 'B' }, created_at: iso(3), updated_at: iso(3) },
    ],
    audit_logs: [
      { id: 'audit_a', user_id: 'user_a', organization_id: 'org_a', actor_type: 'user', event: 'diagnosis.viewed', target_type: 'diagnosis', target_id: 'diag_a', payload_json: { diagnosisId: 'diag_a' }, correlation_id: 'corr_a', created_at: iso(4) },
      { id: 'audit_b', user_id: 'user_b', organization_id: 'org_b', actor_type: 'user', event: 'diagnosis.viewed', target_type: 'diagnosis', target_id: 'diag_b', payload_json: { diagnosisId: 'diag_b' }, correlation_id: 'corr_b', created_at: iso(4) },
    ],
    source_extraction_runs: [
      { id: 'ingestion_a', registry_source_id: 'official-subsidy-secretariats', status: 'finished', started_at: iso(1), finished_at: iso(1), stats_json: { subsidyRounds: 1 }, error_json: {} },
    ],
    source_records: [
      { id: 'source_a', registry_source_id: 'official-subsidy-secretariats', external_id: 'round_a', source_url: 'https://example.test/subsidy', content_hash: 'a'.repeat(64), raw_ref: 'fixture', fetched_at: iso(1), last_seen_at: iso(1), review_status: 'published', published_at: iso(1), created_at: iso(1), updated_at: iso(1), registry_name: 'official', license_status: 'yellow', commercial_use: 'unresolved', redistribution: 'unresolved', terms_url: 'https://example.test/terms' },
    ],
    notification_settings: [
      { id: 'notification_a', user_id: 'user_a', organization_id: null, push_enabled: true, email_enabled: false, deadline_enabled: true, updated_at: iso(3) },
    ],
  }
}

function postgresSeedStore() {
  return {
    meta: { schemaVersion: 1, initializedAt: iso(1) },
    users: [{ id: 'usr_dev_owner', email: 'owner@example.test', displayName: '開発用ユーザー', role: 'owner' }],
    organizations: [],
    organizationMemberships: [],
    companies: [],
    diagnoses: [],
    matches: [],
    applicantConfirmations: [],
    plans: [],
    exports: [],
    notifications: [],
    leads: [],
    auditLogs: [],
    ingestionRuns: [{ id: 'ingestion_seed_test', source: 'fixture', startedAt: iso(1), finishedAt: iso(1), stats: { subsidyRounds: 1 } }],
    sourceRecords: [
      {
        id: 'source_shoryokuka-ippan-7',
        registrySourceId: 'official-subsidy-secretariats',
        externalId: 'shoryokuka-ippan-7',
        sourceUrl: 'https://example.test/shoryokuka',
        contentHash: 'b'.repeat(64),
        rawRef: 'test-fixture',
        fetchedAt: iso(1),
        lastSeenAt: iso(1),
        status: 'draft',
        licenseStatus: 'yellow',
        commercialUse: 'unresolved',
        redistribution: 'unresolved',
      },
    ],
    notificationSettings: { push: true, email: true, deadline: true },
  }
}

function iso(second) {
  return `2026-06-20T00:00:0${second}.000Z`
}
