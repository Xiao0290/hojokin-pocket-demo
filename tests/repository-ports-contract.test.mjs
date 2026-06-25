import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import {
  REPOSITORY_PORT_CONTRACTS,
  REPOSITORY_PORTS,
  assertRepositoryPorts,
  describeRepositoryPorts,
  makeLocalRepositoryPorts,
} from '../server/repositoryPorts.mjs'
import { LocalMockStoreRepository } from '../server/storeRepository.mjs'

test('repository ports publish replaceable domain contracts', () => {
  assert.deepEqual(Object.keys(REPOSITORY_PORTS), [
    'UserRepository',
    'OrganizationRepository',
    'CompanyRepository',
    'DiagnosisRepository',
    'SubsidyRepository',
    'BusinessPlanRepository',
    'ExportedFileRepository',
    'LeadRequestRepository',
    'AuditLogRepository',
  ])

  for (const [portName, methods] of Object.entries(REPOSITORY_PORTS)) {
    const contract = REPOSITORY_PORT_CONTRACTS[portName]
    assert.ok(contract.responsibility, `${portName} should document responsibility`)
    for (const method of methods) {
      assert.ok(contract.input[method], `${portName}.${method} should document input shape`)
      assert.ok(contract.output[method], `${portName}.${method} should document output shape`)
    }
  }

  const descriptions = describeRepositoryPorts()
  assert.equal(descriptions.length, 9)
  assert.ok(descriptions.find((item) => item.name === 'LeadRequestRepository').responsibility.includes('consent-gated'))
})

test('repository port validation rejects missing adapter methods', () => {
  assert.throws(
    () => assertRepositoryPorts({
      UserRepository: { getById: async () => null, listForScope: async () => [] },
      OrganizationRepository: { listForUser: async () => [] },
      CompanyRepository: { listForUser: async () => [], getForUser: async () => null },
      DiagnosisRepository: { listForUser: async () => [], getBundleForUser: async () => null },
      SubsidyRepository: { listActiveRounds: async () => [], getRound: async () => null, listSourceRecords: async () => [], listIngestionRuns: async () => [] },
      BusinessPlanRepository: { listForUser: async () => [], getBundleForUser: async () => null },
      ExportedFileRepository: { getForUser: async () => null, cleanupExpired: async () => ({}) },
      LeadRequestRepository: { listForUser: async () => [], createForUser: async () => ({}) },
      AuditLogRepository: { append: async () => undefined, listForUser: async () => [] },
    }),
    /OrganizationRepository\.listMembershipsForUser/,
  )
})

test('local repository ports preserve scoped access over the existing local store', async (t) => {
  const repository = await createTempRepository(t)
  const store = await repository.reset()
  store.users.push(
    { id: 'repo_user_a', email: 'a@example.test', role: 'owner' },
    { id: 'repo_user_b', email: 'b@example.test', role: 'owner' },
  )
  store.organizations.push(
    { id: 'repo_org_a', name: 'Repo Org A' },
    { id: 'repo_org_b', name: 'Repo Org B' },
  )
  store.organizationMemberships.push(
    { id: 'repo_membership_a', userId: 'repo_user_a', organizationId: 'repo_org_a', role: 'owner' },
    { id: 'repo_membership_b', userId: 'repo_user_b', organizationId: 'repo_org_b', role: 'owner' },
  )
  store.companies.push(
    { id: 'repo_company_a', userId: 'repo_user_a', name: 'Repo Company A' },
    { id: 'repo_company_b', userId: 'repo_user_b', name: 'Repo Company B' },
  )
  store.diagnoses.push(
    { id: 'repo_diag_a', userId: 'repo_user_a', companyId: 'repo_company_a', status: 'done' },
    { id: 'repo_diag_b', userId: 'repo_user_b', companyId: 'repo_company_b', status: 'done' },
  )
  store.matches.push(
    { id: 'repo_match_a', userId: 'repo_user_a', diagnosisId: 'repo_diag_a', roundId: 'shoryokuka-ippan-7', rank: 1 },
    { id: 'repo_match_b', userId: 'repo_user_b', diagnosisId: 'repo_diag_b', roundId: 'shoryokuka-ippan-7', rank: 1 },
  )
  store.plans.push(
    { id: 'repo_plan_a', userId: 'repo_user_a', companyId: 'repo_company_a', exports: [{ fileUrl: '/exports/repo_plan_a.pdf', expiresAt: '2099-01-01T00:00:00.000Z' }] },
    { id: 'repo_plan_b', userId: 'repo_user_b', companyId: 'repo_company_b', exports: [{ fileUrl: '/exports/repo_plan_b.pdf', expiresAt: '2099-01-01T00:00:00.000Z' }] },
  )
  store.leads.push(
    { id: 'repo_lead_a', userId: 'repo_user_a' },
    { id: 'repo_lead_b', userId: 'repo_user_b' },
  )
  store.auditLogs.push(
    { id: 'repo_audit_a', userId: 'repo_user_a', event: 'repo.a' },
    { id: 'repo_audit_b', userId: 'repo_user_b', event: 'repo.b' },
  )
  await repository.save(store)

  const ports = makeLocalRepositoryPorts(repository)
  const scope = { userId: 'repo_user_a' }

  assert.equal((await ports.UserRepository.getById('repo_user_a')).email, 'a@example.test')
  assert.deepEqual((await ports.UserRepository.listForScope(scope)).map((item) => item.id), ['repo_user_a'])
  assert.deepEqual((await ports.OrganizationRepository.listForUser(scope)).map((item) => item.id), ['repo_org_a'])
  assert.deepEqual((await ports.OrganizationRepository.listMembershipsForUser(scope)).map((item) => item.id), ['repo_membership_a'])
  assert.deepEqual((await ports.CompanyRepository.listForUser(scope)).map((item) => item.id), ['repo_company_a'])
  assert.equal((await ports.CompanyRepository.getForUser(scope, 'repo_company_a')).name, 'Repo Company A')
  assert.equal(await ports.CompanyRepository.getForUser({ userId: 'repo_user_b' }, 'repo_company_a'), null)

  const diagnosisBundle = await ports.DiagnosisRepository.getBundleForUser(scope, 'repo_diag_a')
  assert.equal(diagnosisBundle.company.id, 'repo_company_a')
  assert.deepEqual(diagnosisBundle.matches.map((item) => item.id), ['repo_match_a'])

  const planBundle = await ports.BusinessPlanRepository.getBundleForUser(scope, 'repo_plan_a')
  assert.equal(planBundle.company.id, 'repo_company_a')
  assert.equal(await ports.ExportedFileRepository.getForUser(scope, 'repo_plan_a.pdf').then((record) => record.planId), 'repo_plan_a')

  const round = await ports.SubsidyRepository.getRound('shoryokuka-ippan-7')
  assert.equal(round.roundId, 'shoryokuka-ippan-7')
  assert.ok((await ports.SubsidyRepository.listSourceRecords()).length > 0)
  assert.ok((await ports.SubsidyRepository.listIngestionRuns()).length > 0)

  const lead = await ports.LeadRequestRepository.createForUser(scope, { id: 'repo_lead_created', status: 'waitlist' })
  assert.equal(lead.userId, 'repo_user_a')
  assert.deepEqual((await ports.LeadRequestRepository.listForUser(scope)).map((item) => item.id), ['repo_lead_a', 'repo_lead_created'])

  await ports.AuditLogRepository.append('diagnosis.viewed', { diagnosisId: 'repo_diag_a' }, scope)
  assert.deepEqual((await ports.AuditLogRepository.listForUser(scope)).map((item) => item.event), ['repo.a', 'diagnosis.viewed'])
})

async function createTempRepository(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'hojokin-repository-ports-'))
  t.after(() => fs.rm(dir, { recursive: true, force: true }))
  return new LocalMockStoreRepository({ storePath: path.join(dir, 'store.json') })
}
