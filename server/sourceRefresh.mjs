import crypto from 'node:crypto'

export const SOURCE_STALE_AFTER_DAYS = 14

const STATUS_GROUPS = Object.freeze({
  open: new Set(['open', 'accepting']),
  closed: new Set(['closed', 'closed_waiting_results', 'closed_results_announced']),
  announced: new Set(['announced_not_open', 'announced_acceptance_pending', 'upcoming']),
})

const HASH_FIELDS = [
  'id',
  'program',
  'round',
  'sourceUrl',
  'lastSeenAt',
  'status',
  'acceptStart',
  'acceptEnd',
  'maxLimit',
  'subsidyRate',
  'evidence',
]

export function buildSourceRefreshSummary(program, options = {}) {
  const today = options.today || currentJstDate()
  const sourceRecord = program.sourceRecord || {}
  const contentHash = contentHashForProgram(program)
  const previousContentHash = sourceRecord.contentHash || null
  const staleDays = daysSince(program.lastSeenAt, today)
  const stale = staleDays !== null && staleDays > (sourceRecord.staleAfterDays || SOURCE_STALE_AFTER_DAYS)
  const statusGroup = normalizeRefreshStatus(program.status)
  const evidenceSupport = summarizeEvidenceSupport(program)
  const licenseStatus = sourceRecord.licenseStatus || 'unresolved'
  const automationMode = sourceRecord.automationMode || 'manual'

  return {
    roundId: program.id,
    program: program.program,
    round: program.round,
    sourceUrl: program.sourceUrl,
    lastSeenAt: program.lastSeenAt,
    status: program.status,
    statusGroup,
    stale,
    staleDays,
    staleAfterDays: sourceRecord.staleAfterDays || SOURCE_STALE_AFTER_DAYS,
    warning: stale
      ? `Source metadata is stale: lastSeenAt ${program.lastSeenAt} is ${staleDays} days before ${today}. Confirm the official source before using this round.`
      : null,
    contentHash,
    previousContentHash,
    contentHashChanged: previousContentHash ? previousContentHash !== contentHash : true,
    evidenceSupport,
    evidenceSupportedFields: evidenceSupport.supportedFields,
    evidenceMissingFields: evidenceSupport.missingFields,
    sourceRecord: {
      registrySourceId: sourceRecord.registrySourceId || 'official-subsidy-secretariats',
      licenseStatus,
      commercialUse: sourceRecord.commercialUse || 'restricted',
      redistribution: sourceRecord.redistribution || 'restricted',
      automationMode,
      termsUrl: sourceRecord.termsUrl || null,
      attribution: sourceRecord.attribution || null,
      transformation: sourceRecord.transformation || null,
      displayCaveat: sourceRecord.displayCaveat || null,
    },
    gate: evaluateLicenseGate({ licenseStatus, automationMode }),
  }
}

export function currentJstDate(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

export function contentHashForProgram(program) {
  const value = HASH_FIELDS.reduce((draft, field) => {
    if (field in program) draft[field] = program[field]
    return draft
  }, {})
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

export function normalizeRefreshStatus(status) {
  const value = String(status || '')
  for (const [group, values] of Object.entries(STATUS_GROUPS)) {
    if (values.has(value) || value.startsWith(group)) return group
  }
  return 'unknown'
}

export function summarizeEvidenceSupport(program) {
  const supportedFields = new Set()
  const evidence = Array.isArray(program.evidence) ? program.evidence : []
  for (const item of evidence) {
    for (const field of item.supports || []) {
      supportedFields.add(field)
    }
  }

  const requiredFields = [
    'sourceUrl',
    'status',
    'acceptStart',
    'acceptEnd',
    'maxLimit',
    'subsidyRate',
    'requirements',
    'requiredDocuments',
  ]
  const missingFields = requiredFields.filter((field) => !supportedFields.has(field))
  return {
    count: evidence.length,
    supportedFields: Array.from(supportedFields),
    missingFields,
    complete: missingFields.length === 0,
  }
}

export function evaluateLicenseGate({ licenseStatus, automationMode }) {
  if (['blocked', 'unresolved'].includes(licenseStatus)) {
    return {
      productionEtlAllowed: false,
      reason: `licenseStatus=${licenseStatus} cannot run production ETL under source-license-registry gates`,
    }
  }
  if (automationMode === 'automated' && licenseStatus !== 'allowed') {
    return {
      productionEtlAllowed: false,
      reason: 'automated refresh requires an allowed source license or a source-specific restricted-use implementation plan',
    }
  }
  return {
    productionEtlAllowed: false,
    reason: 'dry-run only; production ETL remains out of scope for Issue #4',
  }
}

function daysSince(value, today) {
  if (!value) return null
  const start = Date.parse(`${String(value).slice(0, 10)}T00:00:00+09:00`)
  const end = Date.parse(`${String(today).slice(0, 10)}T00:00:00+09:00`)
  if (Number.isNaN(start) || Number.isNaN(end)) return null
  return Math.floor((end - start) / 86_400_000)
}
