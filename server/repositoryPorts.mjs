import { filterOwned, findOwned, toAccessScope } from './accessBoundary.mjs'
import { activeSubsidyRounds } from './fixtures.mjs'
import { defaultStoreRepository } from './storeRepository.mjs'

export const REPOSITORY_PORTS = Object.freeze({
  UserRepository: Object.freeze(['getById', 'listForScope']),
  OrganizationRepository: Object.freeze(['listForUser', 'listMembershipsForUser']),
  CompanyRepository: Object.freeze(['listForUser', 'getForUser']),
  DiagnosisRepository: Object.freeze(['listForUser', 'getBundleForUser']),
  SubsidyRepository: Object.freeze(['listActiveRounds', 'getRound', 'listSourceRecords', 'listIngestionRuns']),
  BusinessPlanRepository: Object.freeze(['listForUser', 'getBundleForUser']),
  ExportedFileRepository: Object.freeze(['getForUser', 'cleanupExpired']),
  LeadRequestRepository: Object.freeze(['listForUser', 'createForUser']),
  AuditLogRepository: Object.freeze(['append', 'listForUser']),
})

export const REPOSITORY_PORT_CONTRACTS = Object.freeze({
  UserRepository: {
    responsibility: 'Read beta users through a replaceable persistence adapter.',
    input: {
      getById: '{ userId: string }',
      listForScope: '{ userId: string }',
    },
    output: {
      getById: 'User | null',
      listForScope: 'User[] scoped to the current actor',
    },
  },
  OrganizationRepository: {
    responsibility: 'Read organizations and memberships visible to the current user.',
    input: {
      listForUser: '{ userId: string }',
      listMembershipsForUser: '{ userId: string }',
    },
    output: {
      listForUser: 'Organization[]',
      listMembershipsForUser: 'OrganizationMembership[]',
    },
  },
  CompanyRepository: {
    responsibility: 'Read diagnosed companies without crossing user or tenant scope.',
    input: {
      listForUser: '{ userId: string }',
      getForUser: '{ userId: string }, companyId',
    },
    output: {
      listForUser: 'Company[]',
      getForUser: 'Company | null',
    },
  },
  DiagnosisRepository: {
    responsibility: 'Read diagnosis records and match bundles for the current user.',
    input: {
      listForUser: '{ userId: string }',
      getBundleForUser: '{ userId: string }, diagnosisId',
    },
    output: {
      listForUser: 'Diagnosis[]',
      getBundleForUser: '{ diagnosis, company, matches } | null',
    },
  },
  SubsidyRepository: {
    responsibility: 'Read subsidy rounds and source-review traceability records.',
    input: {
      listActiveRounds: 'void',
      getRound: 'roundId',
      listSourceRecords: 'void',
      listIngestionRuns: 'void',
    },
    output: {
      listActiveRounds: 'SubsidyRound[]',
      getRound: 'SubsidyRound | null',
      listSourceRecords: 'SourceRecord[]',
      listIngestionRuns: 'IngestionRun[]',
    },
  },
  BusinessPlanRepository: {
    responsibility: 'Read applicant-owned business plan records through scoped access.',
    input: {
      listForUser: '{ userId: string }',
      getBundleForUser: '{ userId: string }, planId',
    },
    output: {
      listForUser: 'BusinessPlan[]',
      getBundleForUser: '{ plan, company } | null',
    },
  },
  ExportedFileRepository: {
    responsibility: 'Resolve export records and cleanup expired exports through a replaceable boundary.',
    input: {
      getForUser: '{ userId: string }, filename',
      cleanupExpired: '{ now?: Date, deleteFiles?: boolean }',
    },
    output: {
      getForUser: 'ExportedFile | null',
      cleanupExpired: '{ removedCount, removed }',
    },
  },
  LeadRequestRepository: {
    responsibility: 'Persist consent-gated expert lead or waitlist requests without enabling marketplace behavior.',
    input: {
      listForUser: '{ userId: string }',
      createForUser: '{ userId: string }, lead',
    },
    output: {
      listForUser: 'LeadRequest[]',
      createForUser: 'LeadRequest',
    },
  },
  AuditLogRepository: {
    responsibility: 'Append and read scoped audit events without exposing unrelated user data; no update or delete operations are part of the repository contract.',
    input: {
      append: 'event, payload, { userId: string, role?: string, organizationId?: string }',
      listForUser: '{ userId: string }',
    },
    output: {
      append: 'void',
      listForUser: 'AuditLog[]',
    },
  },
})

export function assertRepositoryPorts(ports) {
  for (const [portName, methods] of Object.entries(REPOSITORY_PORTS)) {
    const candidate = ports?.[portName]
    if (!candidate || typeof candidate !== 'object') {
      throw new TypeError(`Missing repository port: ${portName}`)
    }
    for (const method of methods) {
      if (typeof candidate[method] !== 'function') {
        throw new TypeError(`Missing repository port method: ${portName}.${method}`)
      }
    }
  }
  return ports
}

export function describeRepositoryPorts() {
  return Object.entries(REPOSITORY_PORT_CONTRACTS).map(([name, contract]) => ({
    name,
    ...contract,
    methods: REPOSITORY_PORTS[name],
  }))
}

export function makeLocalRepositoryPorts(storeRepository = defaultStoreRepository) {
  const ports = {
    UserRepository: {
      getById: async (userId) => {
        const store = await storeRepository.load()
        return store.users.find((user) => user.id === userId || user.userId === userId) || null
      },
      listForScope: async (scopeLike) => {
        const snapshot = await storeRepository.loadUserSnapshot(scopeLike)
        return snapshot.users
      },
    },
    OrganizationRepository: {
      listForUser: async (scopeLike) => {
        const snapshot = await storeRepository.loadUserSnapshot(scopeLike)
        return snapshot.organizations || []
      },
      listMembershipsForUser: async (scopeLike) => {
        const snapshot = await storeRepository.loadUserSnapshot(scopeLike)
        return snapshot.organizationMemberships || []
      },
    },
    CompanyRepository: {
      listForUser: async (scopeLike) => {
        const snapshot = await storeRepository.loadUserSnapshot(scopeLike)
        return snapshot.companies
      },
      getForUser: async (scopeLike, companyId) => {
        const snapshot = await storeRepository.loadUserSnapshot(scopeLike)
        return findOwned(snapshot.companies, scopeLike, (company) => company.id === companyId)
      },
    },
    DiagnosisRepository: {
      listForUser: async (scopeLike) => {
        const snapshot = await storeRepository.loadUserSnapshot(scopeLike)
        return snapshot.diagnoses
      },
      getBundleForUser: (scopeLike, diagnosisId) => storeRepository.getDiagnosisBundleForUser(scopeLike, diagnosisId),
    },
    SubsidyRepository: {
      listActiveRounds: async () => activeSubsidyRounds,
      getRound: async (roundId) => activeSubsidyRounds.find((round) => round.roundId === roundId) || null,
      listSourceRecords: async () => {
        const store = await storeRepository.load()
        return store.sourceRecords || []
      },
      listIngestionRuns: async () => {
        const store = await storeRepository.load()
        return store.ingestionRuns || []
      },
    },
    BusinessPlanRepository: {
      listForUser: async (scopeLike) => {
        const snapshot = await storeRepository.loadUserSnapshot(scopeLike)
        return snapshot.plans
      },
      getBundleForUser: (scopeLike, planId) => storeRepository.getPlanBundleForUser(scopeLike, planId),
    },
    ExportedFileRepository: {
      getForUser: (scopeLike, filename) => storeRepository.getExportRecordForUser(scopeLike, filename),
      cleanupExpired: (options) => storeRepository.cleanupExpiredExports(options),
    },
    LeadRequestRepository: {
      listForUser: async (scopeLike) => {
        const snapshot = await storeRepository.loadUserSnapshot(scopeLike)
        return snapshot.leads
      },
      createForUser: async (scopeLike, lead) => {
        const scope = toAccessScope(scopeLike)
        const record = { ...lead, userId: scope.userId }
        await storeRepository.mutate((store) => {
          store.leads.push(record)
        })
        return record
      },
    },
    AuditLogRepository: {
      append: (event, payload = {}, scopeLike) => {
        const scope = toAccessScope(scopeLike)
        const auditScope = typeof scopeLike === 'string'
          ? scope.userId
          : { ...scopeLike, userId: scope.userId, role: scope.role }
        return storeRepository.appendAudit(event, payload, auditScope)
      },
      listForUser: async (scopeLike) => {
        const snapshot = await storeRepository.loadUserSnapshot(scopeLike)
        return snapshot.auditLogs
      },
    },
  }
  return assertRepositoryPorts(ports)
}

export const defaultRepositoryPorts = makeLocalRepositoryPorts()
