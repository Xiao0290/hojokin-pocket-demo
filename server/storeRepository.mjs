import crypto from 'node:crypto'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { filterOwned, findOwned, toAccessScope } from './accessBoundary.mjs'
import { buildAuditLogRecord } from './auditLogContract.mjs'
import { activeSubsidyRounds } from './fixtures.mjs'
import { PostgresStoreRepository, assertPostgresRuntimeConfig } from './postgresStoreRepository.mjs'
import { seedUser } from './seedData.mjs'
import { ensureDirs, nowIso, readJson, runtimeDir, writeJson } from './utils.mjs'

export const STORE_REPOSITORY_DOMAINS = Object.freeze([
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

export const STORE_REPOSITORY_METHODS = Object.freeze([
  'load',
  'save',
  'reset',
  'mutate',
  'appendAudit',
  'loadUserSnapshot',
  'getDiagnosisBundleForUser',
  'getPlanBundleForUser',
  'getExportRecordForUser',
  'cleanupExpiredExports',
])

export const createInitialStore = () => ({
  meta: {
    schemaVersion: 1,
    initializedAt: nowIso(),
  },
  users: [seedUser],
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
  ingestionRuns: [
    {
      id: 'ingestion_seed_20260620',
      source: 'fixture',
      startedAt: nowIso(),
      finishedAt: nowIso(),
      stats: { subsidyRounds: activeSubsidyRounds.length },
    },
  ],
  sourceRecords: activeSubsidyRounds.map((round) => ({
    id: `source_${round.roundId}`,
    source: 'fixture',
    externalId: round.roundId,
    registrySourceId: round.sourceRecord?.registrySourceId || 'official-subsidy-secretariats',
    sourceUrl: round.program.sourceUrl,
    termsUrl: round.sourceRecord?.termsUrl || null,
    licenseStatus: round.sourceRecord?.licenseStatus || 'unresolved',
    commercialUse: round.sourceRecord?.commercialUse || 'unresolved',
    redistribution: round.sourceRecord?.redistribution || 'unresolved',
    attribution: round.sourceRecord?.attribution || null,
    transformation: round.sourceRecord?.transformation || null,
    displayCaveat: round.sourceRecord?.displayCaveat || 'Always confirm on the official source.',
    contentHash: round.sourceRefresh?.contentHash || round.sourceRecord?.contentHash || hashRoundSource(round),
    rawRef: round.rawFixtureId ? 'data/fixtures/subsidy-programs.json' : 'server/seedData.mjs',
    fetchedAt: round.lastSeenAt,
    lastSeenAt: round.lastSeenAt,
    status: round.sourceRefresh?.statusGroup || round.status,
    stale: round.sourceRefresh?.stale || false,
    evidenceSupportedFields: round.sourceRefresh?.evidenceSupportedFields || [],
    evidenceMissingFields: round.sourceRefresh?.evidenceMissingFields || [],
    gate: round.sourceRefresh?.gate || null,
  })),
  notificationSettings: {
    push: true,
    email: true,
    deadline: true,
  },
})

export class LocalMockStoreRepository {
  constructor({ storePath = path.join(runtimeDir, 'store.json'), initialStore = createInitialStore } = {}) {
    this.storePath = storePath
    this.initialStore = initialStore
    this.writeLock = Promise.resolve()
  }

  async load() {
    await ensureDirs()
    return readJson(this.storePath, this.initialStore())
  }

  async save(store) {
    await writeJson(this.storePath, store)
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
    await this.mutate((store) => {
      store.auditLogs.push(buildAuditLogRecord({
        id: `audit_${store.auditLogs.length + 1}`,
        event,
        payload,
        scope: scopeLike,
        correlationId: options.correlationId || null,
        createdAt: options.createdAt || nowIso(),
      }))
    })
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
}

export function storeBackendFromEnv(env = process.env) {
  return String(env.STORE_BACKEND || 'local').toLowerCase()
}

export function createStoreRepositoryForBackend(env = process.env) {
  const backend = storeBackendFromEnv(env)
  if (backend === 'local' || backend === 'json') {
    return new LocalMockStoreRepository()
  }
  if (backend === 'postgres') {
    assertPostgresRuntimeConfig(env)
    return new PostgresStoreRepository({
      databaseUrl: env.DATABASE_URL,
      initialStore: createInitialStore,
    })
  }
  throw Object.assign(new Error(`Unsupported STORE_BACKEND: ${backend}`), {
    code: 'STORE_BACKEND_UNSUPPORTED',
  })
}

export const defaultStoreRepository = createStoreRepositoryForBackend()

function hashRoundSource(round) {
  const value = JSON.stringify({
    roundId: round.roundId,
    sourceUrl: round.program.sourceUrl,
    lastSeenAt: round.lastSeenAt,
    status: round.status,
    acceptStart: round.acceptStart,
    acceptEnd: round.acceptEnd,
    maxLimit: round.maxLimit,
    subsidyRate: round.subsidyRate,
    evidence: round.evidence,
  })
  return crypto.createHash('sha256').update(value).digest('hex')
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
