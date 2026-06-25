import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  AUDIT_APPEND_ONLY_BOUNDARY,
  AUDIT_EVENT_TARGETS,
  AUDIT_EVENT_TYPES,
  AUDIT_LOG_SCHEMA_VERSION,
  AUDIT_MINIMUM_ACTION_EVENTS,
  AUDIT_REDACTION_VALUE,
  AUDIT_REQUIRED_FIELDS,
  buildAuditLogRecord,
  isAuditEventType,
} from '../server/auditLogContract.mjs'
import { REPOSITORY_PORTS } from '../server/repositoryPorts.mjs'

test('audit event contract covers closed-beta minimum user and admin actions', () => {
  const required = [
    'diagnosis.started',
    'diagnosis.completed',
    'diagnosis.viewed',
    'match.viewed',
    'confirmation.updated',
    'business_plan.started',
    'business_plan.completed',
    'business_plan.section_edited',
    'business_plan.exported',
    'expert_waitlist.submitted',
    'file.downloaded',
    'admin.source_reviewed',
  ]

  for (const event of required) {
    assert.equal(isAuditEventType(event), true, `${event} should be an audit event type`)
    assert.ok(AUDIT_MINIMUM_ACTION_EVENTS.includes(event), `${event} should be a minimum closed-beta action`)
    assert.ok(AUDIT_EVENT_TARGETS[event], `${event} should declare target resolution`)
  }

  for (const reservedAlternative of [
    'diagnosis.created',
    'business_plan.generated',
    'lead_request.created',
    'admin.source_viewed',
  ]) {
    assert.ok(AUDIT_EVENT_TYPES.includes(reservedAlternative), `${reservedAlternative} should be reserved for adapters/UI variants`)
  }
})

test('audit records normalize required fields, actor, target, correlation id, and redaction', () => {
  const record = buildAuditLogRecord({
    id: 'audit_contract_1',
    event: 'lead_request.created',
    payload: {
      leadId: 'lead_contract_1',
      diagnosisId: 'diag_contract_1',
      contactEmail: 'owner@example.test',
      phoneNumber: '+81-90-0000-0000',
      paymentCard: '4111111111111111',
      status: 'waitlisted',
    },
    scope: { userId: 'user_contract_1', role: 'owner', organizationId: 'org_contract_1' },
    correlationId: 'corr_contract_1',
    createdAt: '2026-06-20T00:00:00.000Z',
  })

  for (const field of AUDIT_REQUIRED_FIELDS) {
    assert.notEqual(record[field], undefined, `${field} should be present`)
  }
  assert.equal(record.schemaVersion, AUDIT_LOG_SCHEMA_VERSION)
  assert.equal(record.event, 'lead_request.created')
  assert.equal(record.eventType, 'lead_request.created')
  assert.deepEqual(record.actor, {
    type: 'user',
    userId: 'user_contract_1',
    organizationId: 'org_contract_1',
    role: 'owner',
  })
  assert.equal(record.targetType, 'lead_request')
  assert.equal(record.targetId, 'lead_contract_1')
  assert.deepEqual(record.target, { type: 'lead_request', id: 'lead_contract_1' })
  assert.equal(record.correlationId, 'corr_contract_1')
  assert.equal(record.payload.contactEmail, AUDIT_REDACTION_VALUE)
  assert.equal(record.payload.phoneNumber, AUDIT_REDACTION_VALUE)
  assert.equal(record.payload.paymentCard, AUDIT_REDACTION_VALUE)
  assert.equal(record.payload.status, 'waitlisted')
})

test('audit contract rejects unsupported free-form event names', () => {
  assert.throws(
    () => buildAuditLogRecord({
      id: 'audit_bad_1',
      event: 'freeform.updated',
      payload: {},
      scope: { userId: 'user_contract_1' },
    }),
    /Unsupported audit event type/,
  )
})

test('audit repository and HTTP boundary are append/list only', () => {
  assert.deepEqual(REPOSITORY_PORTS.AuditLogRepository, AUDIT_APPEND_ONLY_BOUNDARY.repositoryMethods)
  for (const prohibited of AUDIT_APPEND_ONLY_BOUNDARY.prohibitedMethods) {
    assert.equal(
      REPOSITORY_PORTS.AuditLogRepository.some((method) => method.toLowerCase().includes(prohibited)),
      false,
      `AuditLogRepository should not expose ${prohibited}`,
    )
  }

  const indexSource = readFileSync('server/index.mjs', 'utf8')
  assert.doesNotMatch(indexSource, /req\.method === ['"](?:PUT|PATCH|DELETE)['"][\s\S]{0,120}audit/i)
  assert.doesNotMatch(indexSource, /pathname === ['"]\/v1\/audit/i)
})
