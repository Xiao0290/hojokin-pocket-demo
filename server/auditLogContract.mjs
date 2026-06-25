import crypto from 'node:crypto'

export const AUDIT_LOG_SCHEMA_VERSION = 'audit-log.v1'
export const AUDIT_REDACTION_VALUE = '[REDACTED]'
export const MAX_AUDIT_STRING_LENGTH = 512

export const AUDIT_EVENT_TYPES = Object.freeze([
  'auth.login',
  'diagnosis.created',
  'diagnosis.started',
  'diagnosis.completed',
  'diagnosis.viewed',
  'match.viewed',
  'confirmation.updated',
  'business_plan.generated',
  'business_plan.started',
  'business_plan.completed',
  'business_plan.section_edited',
  'business_plan.exported',
  'lead_request.created',
  'expert_waitlist.submitted',
  'expert_recommendations.viewed',
  'file.downloaded',
  'notification.setting_changed',
  'submission.blocked',
  'admin.source_reviewed',
  'admin.source_viewed',
  'admin.llm_usage_viewed',
])

export const AUDIT_MINIMUM_ACTION_EVENTS = Object.freeze([
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
])

export const AUDIT_REQUIRED_FIELDS = Object.freeze([
  'id',
  'schemaVersion',
  'actor',
  'event',
  'eventType',
  'target',
  'payload',
  'correlationId',
  'createdAt',
])

export const AUDIT_APPEND_ONLY_BOUNDARY = Object.freeze({
  repositoryMethods: Object.freeze(['append', 'listForUser']),
  prohibitedMethods: Object.freeze(['update', 'patch', 'delete', 'remove', 'replace', 'truncate']),
  note: 'Application audit logs are append-only at the repository/API boundary. Local test fixtures can still reset whole stores.',
})

export const AUDIT_EVENT_TARGETS = Object.freeze({
  'auth.login': Object.freeze({ type: 'auth_session', idKeys: Object.freeze(['sessionId']) }),
  'diagnosis.created': Object.freeze({ type: 'diagnosis', idKeys: Object.freeze(['diagnosisId']) }),
  'diagnosis.started': Object.freeze({ type: 'diagnosis', idKeys: Object.freeze(['diagnosisId']) }),
  'diagnosis.completed': Object.freeze({ type: 'diagnosis', idKeys: Object.freeze(['diagnosisId']) }),
  'diagnosis.viewed': Object.freeze({ type: 'diagnosis', idKeys: Object.freeze(['diagnosisId']) }),
  'match.viewed': Object.freeze({ type: 'diagnosis_match_set', idKeys: Object.freeze(['matchId', 'diagnosisId', 'roundId']) }),
  'confirmation.updated': Object.freeze({ type: 'applicant_confirmation', idKeys: Object.freeze(['confirmationId', 'diagnosisId', 'planId']) }),
  'business_plan.generated': Object.freeze({ type: 'business_plan', idKeys: Object.freeze(['planId']) }),
  'business_plan.started': Object.freeze({ type: 'business_plan', idKeys: Object.freeze(['planId']) }),
  'business_plan.completed': Object.freeze({ type: 'business_plan', idKeys: Object.freeze(['planId']) }),
  'business_plan.section_edited': Object.freeze({ type: 'business_plan_section', idKeys: Object.freeze(['sectionId', 'planId']) }),
  'business_plan.exported': Object.freeze({ type: 'business_plan_export', idKeys: Object.freeze(['exportId', 'storageKey', 'fileName', 'filename', 'planId']) }),
  'lead_request.created': Object.freeze({ type: 'lead_request', idKeys: Object.freeze(['leadId']) }),
  'expert_waitlist.submitted': Object.freeze({ type: 'expert_waitlist', idKeys: Object.freeze(['leadId', 'diagnosisId', 'roundId']) }),
  'expert_recommendations.viewed': Object.freeze({ type: 'expert_recommendation_set', idKeys: Object.freeze(['diagnosisId', 'roundId']) }),
  'file.downloaded': Object.freeze({ type: 'exported_file', idKeys: Object.freeze(['exportId', 'fileId', 'storageKey', 'fileName', 'filename', 'planId']) }),
  'notification.setting_changed': Object.freeze({ type: 'notification_settings', idKeys: Object.freeze(['settingId']) }),
  'submission.blocked': Object.freeze({ type: 'business_plan_submission', idKeys: Object.freeze(['planId']) }),
  'admin.source_reviewed': Object.freeze({ type: 'admin_source_review', staticId: 'local_admin_source_review' }),
  'admin.source_viewed': Object.freeze({ type: 'admin_source', idKeys: Object.freeze(['sourceRecordId', 'sourceId']) }),
  'admin.llm_usage_viewed': Object.freeze({ type: 'admin_llm_usage', staticId: 'local_llm_usage_summary' }),
})

const AUDIT_EVENT_TYPE_SET = new Set(AUDIT_EVENT_TYPES)
const SENSITIVE_KEY_WORDS = Object.freeze([
  'email',
  'phone',
  'tel',
  'mobile',
  'contact',
  'address',
  'fullname',
  'payment',
  'card',
  'bank',
  'account',
  'token',
  'secret',
  'password',
  'rawhtml',
  'prompt',
  'message',
  'memo',
  'note',
])

export function assertAuditEventType(event) {
  if (!AUDIT_EVENT_TYPE_SET.has(event)) {
    throw new TypeError(`Unsupported audit event type: ${event}`)
  }
  return event
}

export function isAuditEventType(event) {
  return AUDIT_EVENT_TYPE_SET.has(event)
}

export function buildAuditLogRecord({
  id,
  event,
  payload = {},
  userId = null,
  scope = null,
  actorType = null,
  organizationId = null,
  correlationId = null,
  createdAt = new Date().toISOString(),
} = {}) {
  if (!id) throw new TypeError('Audit log id is required')
  const eventType = assertAuditEventType(event)
  const actor = normalizeAuditActor({ scope, userId, actorType, organizationId })
  const target = resolveAuditTarget(eventType, payload)
  const safePayload = sanitizeAuditPayload(payload)

  return {
    id,
    schemaVersion: AUDIT_LOG_SCHEMA_VERSION,
    userId: actor.userId,
    organizationId: actor.organizationId,
    actorType: actor.type,
    actor,
    event: eventType,
    eventType,
    targetType: target.type,
    targetId: target.id,
    target,
    payload: safePayload,
    correlationId: correlationId || crypto.randomUUID(),
    createdAt,
  }
}

export function sanitizeAuditPayload(value, depth = 0) {
  if (value === null || value === undefined) return value
  if (typeof value === 'string') return truncateAuditString(value)
  if (typeof value === 'number' || typeof value === 'boolean') return value
  if (Array.isArray(value)) return value.map((item) => sanitizeAuditPayload(item, depth + 1))
  if (typeof value !== 'object') return String(value)
  if (depth > 8) return '[MaxDepth]'

  const safe = {}
  for (const [key, raw] of Object.entries(value)) {
    if (raw === undefined) continue
    if (isSensitiveAuditKey(key)) {
      safe[key] = AUDIT_REDACTION_VALUE
      continue
    }
    safe[key] = sanitizeAuditPayload(raw, depth + 1)
  }
  return safe
}

export function isSensitiveAuditKey(key) {
  const normalized = String(key).toLowerCase().replace(/[^a-z0-9]/g, '')
  return SENSITIVE_KEY_WORDS.some((word) => normalized.includes(word))
}

function normalizeAuditActor({ scope, userId, actorType, organizationId }) {
  const source = scope || {}
  const resolvedUserId = typeof source === 'string'
    ? source
    : source.userId || source.id || userId
  if (!resolvedUserId) throw new TypeError('Audit actor userId is required')
  const role = typeof source === 'string' ? null : source.role || null
  const type = actorType || actorTypeForRole(role)
  return {
    type,
    userId: resolvedUserId,
    organizationId: typeof source === 'string' ? organizationId || null : source.organizationId || organizationId || null,
    role,
  }
}

function actorTypeForRole(role) {
  if (role === 'system_admin') return 'system_admin'
  if (role === 'admin') return 'admin'
  return 'user'
}

function resolveAuditTarget(event, payload) {
  const contract = AUDIT_EVENT_TARGETS[event]
  const id = contract.staticId || firstPresent(payload, contract.idKeys) || null
  return {
    type: contract.type,
    id: id === undefined || id === null ? null : String(id),
  }
}

function firstPresent(payload, keys = []) {
  for (const key of keys) {
    if (payload?.[key] !== undefined && payload?.[key] !== null && payload?.[key] !== '') {
      return payload[key]
    }
  }
  return null
}

function truncateAuditString(value) {
  if (value.length <= MAX_AUDIT_STRING_LENGTH) return value
  return `${value.slice(0, MAX_AUDIT_STRING_LENGTH)}...[truncated]`
}
