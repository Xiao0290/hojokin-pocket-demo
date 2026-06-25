import { promises as fs } from 'node:fs'
import path from 'node:path'
import pg from 'pg'
import { filterOwned, findOwned, toAccessScope } from './accessBoundary.mjs'
import { AUDIT_LOG_SCHEMA_VERSION, buildAuditLogRecord } from './auditLogContract.mjs'
import { activeSubsidyRounds } from './fixtures.mjs'
import { DISCLAIMER, seedUser } from './seedData.mjs'
import { nowIso } from './utils.mjs'

const { Pool } = pg

const DELETE_ORDER = Object.freeze([
  'source_review_decisions',
  'source_field_citations',
  'source_extraction_runs',
  'exported_files',
  'lead_requests',
  'consent_records',
  'applicant_confirmations',
  'subsidy_matches',
  'business_plans',
  'diagnoses',
  'companies',
  'notification_settings',
  'audit_logs',
  'organization_memberships',
  'subsidy_rounds',
  'subsidy_programs',
  'source_records',
  'source_registry',
  'organizations',
  'users',
])

export class PostgresStoreRepository {
  constructor({
    databaseUrl = process.env.DATABASE_URL,
    client = null,
    initialStore = null,
  } = {}) {
    if (!client && !databaseUrl) {
      throw Object.assign(new Error('DATABASE_URL is required when STORE_BACKEND=postgres.'), {
        code: 'POSTGRES_CONFIG_REQUIRED',
      })
    }
    this.client = client || new Pool({
      connectionString: databaseUrl,
      max: Number(process.env.PG_POOL_MAX || 5),
    })
    this.ownsClient = !client
    this.initialStore = initialStore || (() => ({
      meta: { schemaVersion: 1, initializedAt: nowIso() },
      users: [],
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
      ingestionRuns: [],
      sourceRecords: [],
      notificationSettings: { push: true, email: true, deadline: true },
    }))
    this.writeLock = Promise.resolve()
  }

  async close() {
    if (this.ownsClient && typeof this.client.end === 'function') {
      await this.client.end()
    }
  }

  async load() {
    const baseline = this.initialStore()
    const [
      users,
      organizations,
      organizationMemberships,
      companies,
      diagnoses,
      matches,
      applicantConfirmations,
      plans,
      exportedFiles,
      consentRecords,
      leads,
      auditLogs,
      ingestionRuns,
      sourceRecords,
      notificationSettings,
    ] = await Promise.all([
      this.queryRows('SELECT * FROM users ORDER BY created_at ASC, id ASC'),
      this.queryRows('SELECT * FROM organizations ORDER BY created_at ASC, id ASC'),
      this.queryRows('SELECT * FROM organization_memberships ORDER BY created_at ASC, id ASC'),
      this.queryRows('SELECT * FROM companies ORDER BY created_at ASC, id ASC'),
      this.queryRows('SELECT * FROM diagnoses ORDER BY created_at ASC, id ASC'),
      this.queryRows('SELECT * FROM subsidy_matches ORDER BY diagnosis_id ASC, rank ASC, created_at ASC'),
      this.queryRows('SELECT * FROM applicant_confirmations ORDER BY created_at ASC, id ASC'),
      this.queryRows('SELECT * FROM business_plans ORDER BY created_at ASC, id ASC'),
      this.queryRows('SELECT * FROM exported_files ORDER BY created_at ASC, id ASC'),
      this.queryRows('SELECT * FROM consent_records ORDER BY created_at ASC, id ASC'),
      this.queryRows('SELECT * FROM lead_requests ORDER BY created_at ASC, id ASC'),
      this.queryRows('SELECT * FROM audit_logs ORDER BY created_at ASC, id ASC'),
      this.queryRows('SELECT * FROM source_extraction_runs ORDER BY started_at ASC, id ASC'),
      this.queryRows(`
        SELECT sr.*, registry.name AS registry_name, registry.license_status, registry.commercial_use,
               registry.redistribution, registry.terms_url
        FROM source_records sr
        LEFT JOIN source_registry registry ON registry.id = sr.registry_source_id
        ORDER BY sr.created_at ASC, sr.id ASC
      `),
      this.queryRows('SELECT * FROM notification_settings ORDER BY updated_at DESC, id ASC'),
    ])

    const exportsByPlan = groupBy(exportedFiles.map(rowToExportRecord), 'planId')
    return {
      ...baseline,
      users: users.map(rowToUser),
      organizations: organizations.map(rowToOrganization),
      organizationMemberships: organizationMemberships.map(rowToOrganizationMembership),
      companies: companies.map(rowToCompany),
      diagnoses: diagnoses.map(rowToDiagnosis),
      matches: matches.map(rowToMatch),
      applicantConfirmations: applicantConfirmations.map(rowToApplicantConfirmation),
      plans: plans.map((row) => rowToPlan(row, exportsByPlan.get(row.id) || [])),
      exports: exportedFiles.map(rowToExportRecord),
      notifications: [],
      leads: leads.map(rowToLeadRequest),
      auditLogs: auditLogs.map(rowToAuditLog),
      ingestionRuns: ingestionRuns.map(rowToIngestionRun),
      sourceRecords: sourceRecords.map(rowToSourceRecord),
      notificationSettings: notificationSettings[0]
        ? rowToNotificationSettings(notificationSettings[0])
        : baseline.notificationSettings,
      consentRecords: consentRecords.map(rowToConsentRecord),
    }
  }

  async save(store) {
    const sourceRecords = Array.isArray(store.sourceRecords) && store.sourceRecords.length > 0
      ? store.sourceRecords
      : this.initialStore().sourceRecords
    await this.transaction(async () => {
      for (const table of DELETE_ORDER) {
        await this.query(`DELETE FROM ${table}`)
      }

      await this.insertUsers(store.users || [])
      await this.insertOrganizations(store.organizations || [])
      await this.insertOrganizationMemberships(store.organizationMemberships || [])
      await this.insertSourceRegistry(sourceRecords)
      await this.insertSourceRecords(sourceRecords)
      await this.insertSubsidyReferenceData()
      await this.insertCompanies(store.companies || [])
      await this.insertDiagnoses(store.diagnoses || [])
      await this.insertMatches(store.matches || [])
      await this.insertApplicantConfirmations(store.applicantConfirmations || [])
      await this.insertBusinessPlans(store.plans || [])
      await this.insertExportedFiles(store.plans || [], store.exports || [])
      await this.insertConsentRecords(store.consentRecords || [])
      await this.insertLeadRequests(store.leads || [])
      await this.insertNotificationSettings(store.notificationSettings)
      await this.insertIngestionRuns(store.ingestionRuns || [])
      await this.insertAuditLogs(store.auditLogs || [])
    })
  }

  async reset() {
    const store = this.initialStore()
    await this.save(store)
    return store
  }

  mutate(mutator) {
    const run = this.writeLock.then(async () => {
      const store = await this.load()
      const result = await mutator(store)
      await this.save(store)
      return result
    })
    this.writeLock = run.catch(() => {})
    return run
  }

  async appendAudit(event, payload = {}, scopeLike = seedUser.id, options = {}) {
    const record = buildAuditLogRecord({
      id: id('audit'),
      event,
      payload,
      scope: scopeLike,
      correlationId: options.correlationId || null,
      createdAt: options.createdAt || nowIso(),
    })
    await this.insertAuditLogRecord(record)
  }

  async insertAuditLogRecord(record) {
    await this.query(`
      INSERT INTO audit_logs (id, user_id, organization_id, actor_type, event, target_type, target_id, payload_json, correlation_id, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10)
    `, [
      record.id,
      record.userId,
      record.organizationId,
      record.actorType,
      record.eventType || record.event,
      record.targetType,
      record.targetId,
      json(record.payload || {}),
      record.correlationId,
      record.createdAt || nowIso(),
    ])
  }

  async loadUserSnapshot(userOrScope) {
    const scope = toAccessScope(userOrScope)
    const store = await this.load()
    return {
      ...store,
      users: filterScopedUsers(store.users, scope),
      organizations: filterScopedOrganizations(store.organizations || [], store.organizationMemberships || [], scope),
      organizationMemberships: filterOwned(store.organizationMemberships || [], scope),
      companies: filterOwned(store.companies, scope),
      diagnoses: filterOwned(store.diagnoses, scope),
      matches: filterOwnedMatches(store.matches, store.diagnoses, scope),
      applicantConfirmations: filterOwned(store.applicantConfirmations || [], scope),
      plans: filterOwned(store.plans, scope),
      exports: filterOwned(store.exports || [], scope),
      notifications: filterOwned(store.notifications || [], scope),
      leads: filterOwned(store.leads, scope),
      auditLogs: filterOwned(store.auditLogs, scope),
    }
  }

  async getDiagnosisBundleForUser(userOrScope, diagnosisId) {
    const scope = toAccessScope(userOrScope)
    const store = await this.load()
    const diagnosis = findOwned(store.diagnoses, scope, (item) => item.id === diagnosisId)
    if (!diagnosis) return null
    const company = findOwned(store.companies, scope, (item) => item.id === diagnosis.companyId)
    const matches = filterOwnedMatches(store.matches, [diagnosis], scope)
      .filter((item) => item.diagnosisId === diagnosis.id)
    return { diagnosis, company, matches }
  }

  async getPlanBundleForUser(userOrScope, planId) {
    const scope = toAccessScope(userOrScope)
    const store = await this.load()
    const plan = findOwned(store.plans, scope, (item) => item.id === planId)
    if (!plan) return null
    const company = findOwned(store.companies, scope, (item) => item.id === plan.companyId)
    return { plan, company }
  }

  async getExportRecordForUser(userOrScope, filename) {
    const scope = toAccessScope(userOrScope)
    const store = await this.load()
    for (const plan of filterOwned(store.plans, scope)) {
      const record = (plan.exports || []).find((item) => exportRecordMatches(item, filename))
      if (record) return { ...record, planId: plan.id, userId: plan.userId }
    }
    return null
  }

  async cleanupExpiredExports({ now = new Date(), deleteFiles = false } = {}) {
    const cutoffMs = new Date(now).getTime()
    const removed = []
    await this.mutate((store) => {
      for (const plan of store.plans) {
        const kept = []
        for (const record of plan.exports || []) {
          if (isExpiredExport(record, cutoffMs)) {
            removed.push({ ...record, planId: plan.id, userId: plan.userId })
          } else {
            kept.push(record)
          }
        }
        plan.exports = kept
      }
      if (Array.isArray(store.exports)) {
        store.exports = store.exports.filter((record) => !isExpiredExport(record, cutoffMs))
      }
    })
    if (deleteFiles) {
      await Promise.all(removed
        .filter((record) => record.filePath)
        .map((record) => fs.rm(record.filePath, { force: true })))
    }
    return {
      removedCount: removed.length,
      removed,
    }
  }

  async queryRows(sql, params = []) {
    return (await this.query(sql, params)).rows || []
  }

  async transaction(callback) {
    await this.query('BEGIN')
    try {
      const result = await callback()
      await this.query('COMMIT')
      return result
    } catch (error) {
      await this.query('ROLLBACK')
      throw error
    }
  }

  query(sql, params = []) {
    return this.client.query(sql, params)
  }

  async insertUsers(users) {
    for (const user of users) {
      await this.query(`
        INSERT INTO users (id, email, display_name, role, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        user.id || user.userId,
        user.email || `${user.id || user.userId}@example.test`,
        user.displayName || user.display_name || user.email || user.id || user.userId,
        user.role || 'owner',
        user.createdAt || nowIso(),
        user.updatedAt || user.createdAt || nowIso(),
      ])
    }
  }

  async insertOrganizations(organizations) {
    for (const organization of organizations) {
      await this.query(`
        INSERT INTO organizations (id, name, created_at, updated_at)
        VALUES ($1, $2, $3, $4)
      `, [
        organization.id,
        organization.name || organization.id,
        organization.createdAt || nowIso(),
        organization.updatedAt || organization.createdAt || nowIso(),
      ])
    }
  }

  async insertOrganizationMemberships(memberships) {
    for (const membership of memberships) {
      await this.query(`
        INSERT INTO organization_memberships (id, user_id, organization_id, role, created_at)
        VALUES ($1, $2, $3, $4, $5)
      `, [
        membership.id,
        membership.userId,
        membership.organizationId,
        membership.role || 'owner',
        membership.createdAt || nowIso(),
      ])
    }
  }

  async insertSourceRegistry(sourceRecords) {
    const registryRows = collectSourceRegistryRows(sourceRecords)
    for (const registry of registryRows) {
      await this.query(`
        INSERT INTO source_registry (id, name, base_url, license_status, commercial_use, redistribution, terms_url, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        registry.id,
        registry.name,
        registry.baseUrl,
        registry.licenseStatus,
        registry.commercialUse,
        registry.redistribution,
        registry.termsUrl,
        registry.createdAt,
        registry.updatedAt,
      ])
    }
  }

  async insertSourceRecords(sourceRecords) {
    for (const record of sourceRecords) {
      await this.query(`
        INSERT INTO source_records (id, registry_source_id, external_id, source_url, content_hash, raw_ref, fetched_at, last_seen_at, review_status, published_at, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `, [
        record.id,
        record.registrySourceId || record.registry_source_id || 'official-subsidy-secretariats',
        record.externalId || record.id,
        record.sourceUrl,
        record.contentHash,
        record.rawRef || null,
        record.fetchedAt || null,
        record.lastSeenAt || null,
        record.reviewStatus || record.status || 'draft',
        record.publishedAt || null,
        record.createdAt || nowIso(),
        record.updatedAt || record.createdAt || nowIso(),
      ])
    }
  }

  async insertSubsidyReferenceData() {
    const programs = new Map()
    for (const round of activeSubsidyRounds) {
      const program = round.program || {}
      if (!programs.has(program.id)) programs.set(program.id, { program, round })
    }
    for (const { program, round } of programs.values()) {
      await this.query(`
        INSERT INTO subsidy_programs (id, name, issuer, issuer_type, overview, source_url, status, source_record_id, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [
        program.id,
        program.name,
        program.issuer || 'official',
        program.issuerType || 'official',
        program.overview || '',
        program.sourceUrl,
        round.status || 'draft',
        `source_${round.roundId}`,
        nowIso(),
        nowIso(),
      ])
    }
    for (const round of activeSubsidyRounds) {
      await this.query(`
        INSERT INTO subsidy_rounds (id, program_id, round_label, status, accept_start, accept_end, max_limit, subsidy_rate, last_seen_at, requirements_json, documents_json, steps_json, source_record_id, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11::jsonb, $12::jsonb, $13, $14, $15)
      `, [
        round.roundId,
        round.program.id,
        round.roundLabel || round.roundId,
        round.status || 'draft',
        round.acceptStart || null,
        round.acceptEnd || null,
        round.maxLimit || null,
        round.subsidyRate || null,
        round.lastSeenAt || null,
        json(round.requirements || []),
        json(round.requiredDocuments || []),
        json(round.steps || []),
        `source_${round.roundId}`,
        nowIso(),
        nowIso(),
      ])
    }
  }

  async insertCompanies(companies) {
    for (const company of companies) {
      await this.query(`
        INSERT INTO companies (id, user_id, organization_id, url, name, prefecture, city, profile_json, citations_json, unknowns_json, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10::jsonb, $11, $12)
      `, [
        company.id,
        company.userId,
        company.organizationId || null,
        company.url || company.profile?.url || `https://example.invalid/companies/${company.id}`,
        company.name || company.profile?.name || null,
        company.prefecture || company.profile?.prefecture || null,
        company.city || company.profile?.city || null,
        json(company.profile || {}),
        json(company.sourceCitations || company.profile?.citations || []),
        json(company.unknowns || company.profile?.unknowns || []),
        company.createdAt || nowIso(),
        company.updatedAt || company.createdAt || nowIso(),
      ])
    }
  }

  async insertDiagnoses(diagnoses) {
    for (const diagnosis of diagnoses) {
      await this.query(`
        INSERT INTO diagnoses (id, user_id, organization_id, company_id, status, progress, events_json, result_json, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9, $10)
      `, [
        diagnosis.id,
        diagnosis.userId,
        diagnosis.organizationId || null,
        diagnosis.companyId,
        diagnosis.status || 'unknown',
        Number(diagnosis.progress || 0),
        json(diagnosis.events || []),
        json(omit(diagnosis, ['id', 'userId', 'organizationId', 'companyId', 'status', 'progress', 'events', 'createdAt', 'updatedAt'])),
        diagnosis.createdAt || diagnosis.startedAt || nowIso(),
        diagnosis.updatedAt || diagnosis.completedAt || diagnosis.createdAt || nowIso(),
      ])
    }
  }

  async insertMatches(matches) {
    for (const match of matches) {
      await this.query(`
        INSERT INTO subsidy_matches (id, user_id, organization_id, diagnosis_id, round_id, rank, score, eligible, reasons_json, warnings_json, provenance_json, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb, $11::jsonb, $12)
      `, [
        match.id || id('match'),
        match.userId,
        match.organizationId || null,
        match.diagnosisId,
        match.roundId,
        Number(match.rank || 0),
        Number(match.score || match.matchScore || 0),
        match.eligible === true,
        json(match.reasons || []),
        json(match.warnings || []),
        json(omit(match, ['id', 'userId', 'organizationId', 'diagnosisId', 'roundId', 'rank', 'score', 'eligible', 'reasons', 'warnings', 'createdAt'])),
        match.createdAt || nowIso(),
      ])
    }
  }

  async insertApplicantConfirmations(confirmations) {
    for (const confirmation of confirmations) {
      await this.query(`
        INSERT INTO applicant_confirmations (id, user_id, organization_id, diagnosis_id, round_id, answers_json, status, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9)
      `, [
        confirmation.id,
        confirmation.userId,
        confirmation.organizationId || null,
        confirmation.diagnosisId,
        confirmation.roundId || confirmation.context?.roundId || activeSubsidyRounds[0]?.roundId,
        json(omit(confirmation, ['id', 'userId', 'organizationId', 'diagnosisId', 'roundId', 'status', 'createdAt', 'updatedAt'])),
        confirmation.status || 'needs_confirmation',
        confirmation.createdAt || nowIso(),
        confirmation.updatedAt || confirmation.createdAt || nowIso(),
      ])
    }
  }

  async insertBusinessPlans(plans) {
    for (const plan of plans) {
      await this.query(`
        INSERT INTO business_plans (id, user_id, organization_id, company_id, diagnosis_id, round_id, status, provenance_json, sections_json, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10, $11)
      `, [
        plan.id,
        plan.userId,
        plan.organizationId || null,
        plan.companyId,
        plan.diagnosisId || null,
        plan.roundId,
        plan.status || 'draft',
        json(omit(plan, ['id', 'userId', 'organizationId', 'companyId', 'diagnosisId', 'roundId', 'status', 'sections', 'exports', 'createdAt', 'updatedAt'])),
        json(plan.sections || []),
        plan.createdAt || nowIso(),
        plan.updatedAt || plan.createdAt || nowIso(),
      ])
    }
  }

  async insertExportedFiles(plans, looseExports) {
    const records = []
    for (const plan of plans) {
      for (const [index, record] of (plan.exports || []).entries()) {
        records.push({ ...record, planId: plan.id, userId: plan.userId, organizationId: plan.organizationId || null, index })
      }
    }
    for (const record of looseExports || []) records.push(record)
    for (const record of records) {
      await this.query(`
        INSERT INTO exported_files (id, user_id, organization_id, plan_id, format, storage_key, filename, mime_type, size_bytes, checksum, file_url, disclaimer_text, expires_at, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      `, [
        record.id || `export_${record.planId}_${record.format || 'file'}_${record.index || 0}`,
        record.userId,
        record.organizationId || null,
        record.planId,
        record.format,
        record.storageKey || record.storage_key || path.basename(record.fileUrl || record.filePath || `${record.planId}.${record.format}`),
        record.filename || record.storageKey || record.storage_key || path.basename(record.fileUrl || record.filePath || `${record.planId}.${record.format}`),
        record.mimeType || record.mime_type || null,
        Number(record.sizeBytes || record.size_bytes || 0),
        record.checksum || null,
        record.fileUrl || null,
        record.disclaimerText || DISCLAIMER,
        record.expiresAt,
        record.createdAt || nowIso(),
      ])
    }
  }

  async insertConsentRecords(records) {
    for (const record of records) {
      await this.query(`
        INSERT INTO consent_records (id, user_id, organization_id, kind, version, granted_at, metadata_json, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)
      `, [
        record.id,
        record.userId,
        record.organizationId || null,
        record.kind || 'expert_lead',
        record.version || 'v1',
        record.grantedAt || record.createdAt || nowIso(),
        json(record.metadata || {}),
        record.createdAt || nowIso(),
      ])
    }
  }

  async insertLeadRequests(leads) {
    for (const lead of leads) {
      await this.query(`
        INSERT INTO lead_requests (id, user_id, organization_id, expert_id, round_id, status, consent_record_id, payload_json, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10)
      `, [
        lead.id,
        lead.userId,
        lead.organizationId || null,
        lead.expertId || null,
        lead.roundId || null,
        lead.status || 'waitlist',
        lead.consentRecordId || null,
        json(omit(lead, ['id', 'userId', 'organizationId', 'expertId', 'roundId', 'status', 'consentRecordId', 'createdAt', 'updatedAt'])),
        lead.createdAt || nowIso(),
        lead.updatedAt || lead.createdAt || nowIso(),
      ])
    }
  }

  async insertNotificationSettings(settings) {
    if (!settings) return
    await this.query(`
      INSERT INTO notification_settings (id, user_id, organization_id, push_enabled, email_enabled, deadline_enabled, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      `notification_${seedUser.id}`,
      seedUser.id,
      null,
      settings.push !== false,
      settings.email !== false,
      settings.deadline !== false,
      nowIso(),
    ])
  }

  async insertIngestionRuns(runs) {
    for (const run of runs) {
      await this.query(`
        INSERT INTO source_extraction_runs (id, registry_source_id, status, started_at, finished_at, stats_json, error_json)
        VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb)
      `, [
        run.id,
        run.registrySourceId || 'official-subsidy-secretariats',
        run.status || run.source || 'finished',
        run.startedAt || nowIso(),
        run.finishedAt || null,
        json(run.stats || {}),
        json(run.error || {}),
      ])
    }
  }

  async insertAuditLogs(logs) {
    for (const log of logs) {
      await this.insertAuditLogRecord(normalizeAuditLogForInsert(log))
    }
  }
}

export function assertPostgresRuntimeConfig(env = process.env) {
  if ((env.STORE_BACKEND || 'local').toLowerCase() !== 'postgres') return
  if (!env.DATABASE_URL) {
    throw Object.assign(new Error('DATABASE_URL is required when STORE_BACKEND=postgres.'), {
      code: 'POSTGRES_CONFIG_REQUIRED',
    })
  }
}

function rowToUser(row) {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    role: row.role,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  }
}

function rowToOrganization(row) {
  return {
    id: row.id,
    name: row.name,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  }
}

function rowToOrganizationMembership(row) {
  return {
    id: row.id,
    userId: row.user_id,
    organizationId: row.organization_id,
    role: row.role,
    createdAt: iso(row.created_at),
  }
}

function rowToCompany(row) {
  const profile = parseJson(row.profile_json, {})
  return {
    id: row.id,
    userId: row.user_id,
    organizationId: row.organization_id,
    url: row.url,
    name: row.name,
    prefecture: row.prefecture,
    city: row.city,
    profile,
    sourceCitations: parseJson(row.citations_json, profile.citations || []),
    unknowns: parseJson(row.unknowns_json, profile.unknowns || []),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  }
}

function rowToDiagnosis(row) {
  return {
    ...parseJson(row.result_json, {}),
    id: row.id,
    userId: row.user_id,
    organizationId: row.organization_id,
    companyId: row.company_id,
    status: row.status,
    progress: Number(row.progress || 0),
    events: parseJson(row.events_json, []),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  }
}

function rowToMatch(row) {
  return {
    ...parseJson(row.provenance_json, {}),
    id: row.id,
    userId: row.user_id,
    organizationId: row.organization_id,
    diagnosisId: row.diagnosis_id,
    roundId: row.round_id,
    rank: Number(row.rank || 0),
    score: Number(row.score || 0),
    eligible: row.eligible === true,
    reasons: parseJson(row.reasons_json, []),
    warnings: parseJson(row.warnings_json, []),
    createdAt: iso(row.created_at),
  }
}

function rowToApplicantConfirmation(row) {
  return {
    ...parseJson(row.answers_json, {}),
    id: row.id,
    userId: row.user_id,
    organizationId: row.organization_id,
    diagnosisId: row.diagnosis_id,
    roundId: row.round_id,
    status: row.status,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  }
}

function rowToPlan(row, exports) {
  return {
    ...parseJson(row.provenance_json, {}),
    id: row.id,
    userId: row.user_id,
    organizationId: row.organization_id,
    companyId: row.company_id,
    diagnosisId: row.diagnosis_id,
    roundId: row.round_id,
    status: row.status,
    sections: parseJson(row.sections_json, []),
    exports,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  }
}

function rowToExportRecord(row) {
  return {
    id: row.id,
    userId: row.user_id,
    organizationId: row.organization_id,
    planId: row.plan_id,
    format: row.format,
    storageKey: row.storage_key,
    filename: row.filename || row.storage_key,
    mimeType: row.mime_type || null,
    sizeBytes: Number(row.size_bytes || 0),
    checksum: row.checksum || null,
    fileUrl: row.file_url,
    disclaimerText: row.disclaimer_text,
    disclaimerIncluded: Boolean(row.disclaimer_text),
    expiresAt: iso(row.expires_at),
    createdAt: iso(row.created_at),
  }
}

function rowToConsentRecord(row) {
  return {
    id: row.id,
    userId: row.user_id,
    organizationId: row.organization_id,
    kind: row.kind,
    version: row.version,
    grantedAt: iso(row.granted_at),
    metadata: parseJson(row.metadata_json, {}),
    createdAt: iso(row.created_at),
  }
}

function rowToLeadRequest(row) {
  return {
    ...parseJson(row.payload_json, {}),
    id: row.id,
    userId: row.user_id,
    organizationId: row.organization_id,
    expertId: row.expert_id,
    roundId: row.round_id,
    status: row.status,
    consentRecordId: row.consent_record_id,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  }
}

function rowToAuditLog(row) {
  const payload = parseJson(row.payload_json, {})
  const actorType = row.actor_type || 'user'
  const targetType = row.target_type || null
  const targetId = row.target_id || null
  return {
    id: row.id,
    schemaVersion: AUDIT_LOG_SCHEMA_VERSION,
    userId: row.user_id,
    organizationId: row.organization_id,
    actorType,
    actor: {
      type: actorType,
      userId: row.user_id,
      organizationId: row.organization_id,
      role: null,
    },
    event: row.event,
    eventType: row.event,
    targetType,
    targetId,
    target: {
      type: targetType,
      id: targetId,
    },
    payload,
    correlationId: row.correlation_id,
    createdAt: iso(row.created_at),
  }
}

function rowToIngestionRun(row) {
  return {
    id: row.id,
    registrySourceId: row.registry_source_id,
    source: row.registry_source_id,
    status: row.status,
    startedAt: iso(row.started_at),
    finishedAt: iso(row.finished_at),
    stats: parseJson(row.stats_json, {}),
    error: parseJson(row.error_json, {}),
  }
}

function rowToSourceRecord(row) {
  return {
    id: row.id,
    registrySourceId: row.registry_source_id,
    registryName: row.registry_name || null,
    externalId: row.external_id,
    sourceUrl: row.source_url,
    contentHash: row.content_hash,
    rawRef: row.raw_ref,
    fetchedAt: iso(row.fetched_at),
    lastSeenAt: iso(row.last_seen_at),
    reviewStatus: row.review_status,
    status: row.review_status,
    publishedAt: iso(row.published_at),
    licenseStatus: row.license_status || 'unresolved',
    commercialUse: row.commercial_use || 'unresolved',
    redistribution: row.redistribution || 'unresolved',
    termsUrl: row.terms_url || null,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  }
}

function rowToNotificationSettings(row) {
  return {
    push: row.push_enabled === true,
    email: row.email_enabled === true,
    deadline: row.deadline_enabled === true,
    updatedAt: iso(row.updated_at),
  }
}

function collectSourceRegistryRows(sourceRecords) {
  const rows = new Map()
  for (const record of sourceRecords) {
    const registrySourceId = record.registrySourceId || record.registry_source_id || 'official-subsidy-secretariats'
    if (rows.has(registrySourceId)) continue
    rows.set(registrySourceId, {
      id: registrySourceId,
      name: record.registryName || registrySourceId,
      baseUrl: originOf(record.sourceUrl || record.termsUrl) || 'https://example.invalid',
      licenseStatus: record.licenseStatus || 'unresolved',
      commercialUse: record.commercialUse || 'unresolved',
      redistribution: record.redistribution || 'unresolved',
      termsUrl: record.termsUrl || null,
      createdAt: record.createdAt || nowIso(),
      updatedAt: record.updatedAt || record.createdAt || nowIso(),
    })
  }
  return [...rows.values()]
}

function filterOwnedMatches(matches = [], diagnoses = [], scopeLike) {
  const scope = toAccessScope(scopeLike)
  const ownedDiagnosisIds = new Set(filterOwned(diagnoses, scope).map((item) => item.id))
  return matches.filter((match) => (
    match?.userId === scope.userId ||
    (!match?.userId && ownedDiagnosisIds.has(match?.diagnosisId))
  ))
}

function filterScopedUsers(users = [], scopeLike) {
  const scope = toAccessScope(scopeLike)
  return users.filter((user) => user?.id === scope.userId || user?.userId === scope.userId)
}

function filterScopedOrganizations(organizations = [], memberships = [], scopeLike) {
  const scope = toAccessScope(scopeLike)
  const organizationIds = new Set(filterOwned(memberships, scope).map((membership) => membership.organizationId))
  return organizations.filter((organization) => organizationIds.has(organization?.id))
}

function isExpiredExport(record, cutoffMs) {
  const expiresMs = new Date(record?.expiresAt || 0).getTime()
  return !Number.isFinite(expiresMs) || expiresMs <= cutoffMs
}

function exportRecordMatches(record, filename) {
  const target = String(filename || '')
  if (!target) return false
  if (record?.storageKey === target || record?.filename === target) return true
  const fileUrl = String(record?.fileUrl || record?.filePath || '')
  if (!fileUrl) return false
  try {
    return path.basename(new URL(fileUrl, 'http://local.invalid').pathname) === target
  } catch {
    return path.basename(fileUrl.split('?')[0]) === target
  }
}

function json(value) {
  return JSON.stringify(value ?? null)
}

function parseJson(value, fallback) {
  if (value == null) return fallback
  if (typeof value === 'string') {
    try {
      return JSON.parse(value)
    } catch {
      return fallback
    }
  }
  return value
}

function omit(record, keys) {
  const blocked = new Set(keys)
  return Object.fromEntries(Object.entries(record || {}).filter(([key]) => !blocked.has(key)))
}

function groupBy(records, key) {
  const grouped = new Map()
  for (const record of records) {
    const value = record[key]
    if (!grouped.has(value)) grouped.set(value, [])
    grouped.get(value).push(record)
  }
  return grouped
}

function originOf(value) {
  try {
    return new URL(value).origin
  } catch {
    return null
  }
}

function iso(value) {
  if (!value) return value
  if (value instanceof Date) return value.toISOString()
  return String(value)
}

function normalizeAuditLogForInsert(log) {
  if (log?.schemaVersion === AUDIT_LOG_SCHEMA_VERSION && log.actor && log.target) {
    return {
      ...log,
      eventType: log.eventType || log.event,
      actorType: log.actorType || log.actor?.type || 'user',
      targetType: log.targetType || log.target?.type || null,
      targetId: log.targetId || log.target?.id || null,
      payload: log.payload || {},
      correlationId: log.correlationId || id('corr'),
      createdAt: log.createdAt || nowIso(),
    }
  }
  return buildAuditLogRecord({
    id: log.id || id('audit'),
    event: log.event,
    payload: log.payload || {},
    scope: {
      userId: log.userId || seedUser.id,
      organizationId: log.organizationId || null,
      role: log.actor?.role || null,
    },
    actorType: log.actorType || log.actor?.type || null,
    correlationId: log.correlationId || null,
    createdAt: log.createdAt || nowIso(),
  })
}

function id(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(16).slice(2, 8)}`
}
