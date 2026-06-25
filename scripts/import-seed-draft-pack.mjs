import { promises as fs } from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { pathToFileURL } from 'node:url'
import { rootDir, runtimeDir, writeJson } from '../server/utils.mjs'

export const DEFAULT_PACK_DIR = path.join(rootDir, 'data/seed-packs/hojokin-pocket-seed-db-v0.1')
export const DEFAULT_OUTPUT_PATH = path.join(runtimeDir, 'seed-draft-store.json')
export const STORE_SCHEMA = 'hojokin-pocket.seed-draft-store.v1'
export const CRITICAL_REVIEW_FIELDS = [
  'application_end',
  'max_amount_yen',
  'subsidy_rate',
  'license_status',
]
export const REVIEW_TASK_FIELD_ALIASES = {
  application_end: ['application_end', 'exact_application_end', 'deadline_text_original'],
  max_amount_yen: ['max_amount_yen', 'max_amount_yen_by_frame', 'max_amount_text_original'],
  subsidy_rate: ['subsidy_rate', 'subsidy_rate_by_frame', 'subsidy_rate_text_original'],
  license_status: ['license_status'],
}

export async function buildSeedDraftStore({
  inputDir = DEFAULT_PACK_DIR,
  generatedAt = new Date().toISOString(),
} = {}) {
  const manifest = await readJson(path.join(inputDir, 'manifest.json'))
  const verifiedFiles = await verifyManifestFiles(inputDir, manifest)
  const sourceRegistry = await readJson(path.join(inputDir, 'source_registry.json'))
  const rawRounds = await readJsonl(path.join(inputDir, 'subsidy_seed_dataset.jsonl'))
  const sourceReviewTasks = await readCsv(path.join(inputDir, 'review_queue.csv'))
  const sourceLicenseReviews = await readCsv(path.join(inputDir, 'license_matrix.csv'))
  const eligibilityRuleDrafts = await readJson(path.join(inputDir, 'eligibility_rule_samples.json'))
  const humanReviewRows = await readCsv(path.join(inputDir, 'human_review_import.csv'))

  assertUnique(sourceRegistry.map((source) => source.source_id), 'source_id')
  assertUnique(rawRounds.map((round) => round.round_key), 'round_key')
  assertUnique(sourceReviewTasks.map((task) => task.task_id), 'task_id')

  const sourceIds = new Set(sourceRegistry.map((source) => source.source_id))
  const taskIndex = buildTaskIndex(sourceReviewTasks)
  const programIdByKey = new Map()
  const subsidyRoundDrafts = rawRounds.map((round) => {
    const programDraftId = programIdForRound(round)
    const programKey = `${round.issuer || ''}::${round.program_name || ''}`
    programIdByKey.set(programKey, {
      programDraftId,
      programName: round.program_name,
      issuer: round.issuer || null,
      issuerType: round.issuer_type || null,
      prefecture: round.prefecture || null,
      municipality: round.municipality || null,
      programType: round.program_type || null,
      reviewRequired: true,
      reviewStatus: 'needs_review',
      publishable: false,
    })

    const criticalMissingFields = CRITICAL_REVIEW_FIELDS.filter((field) => isMissing(round[field]))
    const criticalReviewTaskIds = {}
    for (const field of criticalMissingFields) {
      const matchingTaskIds = findReviewTaskIdsForField(sourceReviewTasks, round, field, taskIndex)
      criticalReviewTaskIds[field] = matchingTaskIds
      const hasTask = matchingTaskIds.length > 0
      if (!hasTask) {
        throw new Error(`Missing review task for ${round.round_key}:${field}`)
      }
    }

    if (!sourceIds.has(round.source_id)) {
      throw new Error(`Unknown source_id for ${round.round_key}: ${round.source_id}`)
    }
    if (round.review_required !== true || round.review_status !== 'needs_review' || round.publishable !== false) {
      throw new Error(`Seed round must remain draft-only: ${round.round_key}`)
    }

    return {
      draftType: 'subsidy_round_draft',
      roundKey: round.round_key,
      programDraftId,
      programName: round.program_name,
      roundName: round.round_name,
      sourceId: round.source_id,
      issuer: round.issuer || null,
      issuerType: round.issuer_type || null,
      prefecture: round.prefecture || null,
      municipality: round.municipality || null,
      targetArea: round.target_area || null,
      status: round.status || null,
      applicationStart: round.application_start || null,
      applicationEnd: round.application_end || null,
      deadlineTextOriginal: round.deadline_text_original || null,
      lastSeenAt: round.last_seen_at || null,
      maxAmountYen: numberOrNull(round.max_amount_yen),
      maxAmountTextOriginal: round.max_amount_text_original || null,
      subsidyRate: round.subsidy_rate || null,
      subsidyRateTextOriginal: round.subsidy_rate_text_original || null,
      targetEntities: arrayOrEmpty(round.target_entities),
      targetIndustries: arrayOrEmpty(round.target_industries),
      excludedIndustries: arrayOrEmpty(round.excluded_industries),
      businessPurposeTags: arrayOrEmpty(round.business_purpose_tags),
      eligibleExpenseCategories: arrayOrEmpty(round.eligible_expense_categories),
      requiredDocuments: arrayOrEmpty(round.required_documents),
      gBizIdRequired: booleanOrNull(round.gBizID_required),
      electronicApplication: round.electronic_application || null,
      adoptionRate: null,
      adoptionRateSourceUrl: null,
      officialPageUrl: round.official_page_url || null,
      guidelinePdfUrl: round.guideline_pdf_url || null,
      applicationFormUrl: round.application_form_url || null,
      sourceUrls: arrayOrEmpty(round.source_urls),
      sourceQuotes: arrayOrEmpty(round.source_quotes),
      licenseStatus: round.license_status || null,
      redistributionAllowed: booleanOrNull(round.redistribution_allowed),
      commercialUseAllowed: booleanOrNull(round.commercial_use_allowed),
      reviewRequired: true,
      reviewStatus: 'needs_review',
      publishable: false,
      confidence: round.confidence || null,
      unknownFields: arrayOrEmpty(round.unknown_fields),
      notes: round.notes || null,
      criticalMissingFields,
      criticalReviewTaskIds,
      reviewTaskIds: sourceReviewTasks
        .filter((task) => task.program_name === round.program_name && task.round_name === round.round_name)
        .map((task) => task.task_id),
      raw: round,
    }
  })

  const subsidyProgramDrafts = Array.from(programIdByKey.values()).sort((a, b) =>
    a.programDraftId.localeCompare(b.programDraftId),
  )

  const unsafePublished = subsidyRoundDrafts.filter((round) => round.publishable || round.reviewStatus !== 'needs_review')
  if (unsafePublished.length > 0) {
    throw new Error(`Seed pack contains publishable round drafts: ${unsafePublished.map((round) => round.roundKey).join(', ')}`)
  }

  const summary = {
    sourceCount: sourceRegistry.length,
    roundDraftCount: subsidyRoundDrafts.length,
    programDraftCount: subsidyProgramDrafts.length,
    reviewTaskCount: sourceReviewTasks.length,
    licenseReviewCount: sourceLicenseReviews.length,
    eligibilityDraftCount: eligibilityRuleDrafts.length,
    humanReviewRowCount: humanReviewRows.length,
    criticalReviewTaskCount: sourceReviewTasks.filter((task) => task.review_reason === 'missing_critical_field').length,
    missingCriticalFieldCount: subsidyRoundDrafts.reduce((sum, round) => sum + round.criticalMissingFields.length, 0),
    publishableCount: subsidyRoundDrafts.filter((round) => round.publishable === true).length,
    canonicalRoundWriteCount: 0,
  }

  assertManifestCounts(manifest, summary)

  return {
    schema: STORE_SCHEMA,
    mode: 'draft_only',
    generatedAt,
    mutation: 'runtime_draft_store_only',
    userSideMatchingVisible: false,
    pack: {
      id: path.basename(inputDir),
      createdAt: manifest.created_at || null,
      manifest,
      sha256Verified: true,
      verifiedFiles,
    },
    summary,
    sourceRegistry,
    subsidyProgramDrafts,
    subsidyRoundDrafts,
    sourceReviewTasks,
    sourceLicenseReviews,
    eligibilityRuleDrafts,
    humanReviewRows,
  }
}

export async function writeSeedDraftStore({
  inputDir = DEFAULT_PACK_DIR,
  outputPath = DEFAULT_OUTPUT_PATH,
  generatedAt,
} = {}) {
  const store = await buildSeedDraftStore({ inputDir, generatedAt })
  await writeJson(outputPath, store)
  return { outputPath, store }
}

export function mergeSeedDraftStores(...stores) {
  const merged = {
    schema: STORE_SCHEMA,
    mode: 'draft_only',
    generatedAt: new Date().toISOString(),
    mutation: 'runtime_draft_store_only',
    userSideMatchingVisible: false,
    pack: stores.find(Boolean)?.pack || null,
    summary: {},
    sourceRegistry: [],
    subsidyProgramDrafts: [],
    subsidyRoundDrafts: [],
    sourceReviewTasks: [],
    sourceLicenseReviews: [],
    eligibilityRuleDrafts: [],
    humanReviewRows: [],
  }

  merged.sourceRegistry = dedupeBy(stores.flatMap((store) => store?.sourceRegistry || []), 'source_id')
  merged.subsidyProgramDrafts = dedupeBy(stores.flatMap((store) => store?.subsidyProgramDrafts || []), 'programDraftId')
  merged.subsidyRoundDrafts = dedupeBy(stores.flatMap((store) => store?.subsidyRoundDrafts || []), 'roundKey')
  merged.sourceReviewTasks = dedupeBy(stores.flatMap((store) => store?.sourceReviewTasks || []), 'task_id')
  merged.sourceLicenseReviews = dedupeBy(stores.flatMap((store) => store?.sourceLicenseReviews || []), 'source_name')
  merged.eligibilityRuleDrafts = dedupeBy(stores.flatMap((store) => store?.eligibilityRuleDrafts || []), 'round_key')
  merged.humanReviewRows = dedupeBy(stores.flatMap((store) => store?.humanReviewRows || []), 'round_key')
  merged.summary = {
    sourceCount: merged.sourceRegistry.length,
    roundDraftCount: merged.subsidyRoundDrafts.length,
    programDraftCount: merged.subsidyProgramDrafts.length,
    reviewTaskCount: merged.sourceReviewTasks.length,
    licenseReviewCount: merged.sourceLicenseReviews.length,
    eligibilityDraftCount: merged.eligibilityRuleDrafts.length,
    humanReviewRowCount: merged.humanReviewRows.length,
    criticalReviewTaskCount: merged.sourceReviewTasks.filter((task) => task.review_reason === 'missing_critical_field').length,
    missingCriticalFieldCount: merged.subsidyRoundDrafts.reduce((sum, round) => sum + round.criticalMissingFields.length, 0),
    publishableCount: 0,
    canonicalRoundWriteCount: 0,
  }
  return merged
}

export async function readSeedDraftStore(filePath = DEFAULT_OUTPUT_PATH) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'))
  } catch (error) {
    if (error.code === 'ENOENT') return null
    throw error
  }
}

async function verifyManifestFiles(inputDir, manifest) {
  const verified = []
  for (const [fileName, expected] of Object.entries(manifest.files || {})) {
    const filePath = path.join(inputDir, fileName)
    const content = await fs.readFile(filePath)
    const actualSha = crypto.createHash('sha256').update(content).digest('hex')
    if (actualSha !== expected.sha256) {
      throw new Error(`SHA256 mismatch for ${fileName}: ${actualSha} !== ${expected.sha256}`)
    }
    if (content.length !== expected.bytes) {
      throw new Error(`Byte length mismatch for ${fileName}: ${content.length} !== ${expected.bytes}`)
    }
    verified.push({ fileName, sha256: actualSha, bytes: content.length })
  }
  return verified
}

function assertManifestCounts(manifest, summary) {
  const expected = [
    ['record_count', 'roundDraftCount'],
    ['source_count', 'sourceCount'],
    ['review_task_count', 'reviewTaskCount'],
    ['eligibility_sample_count', 'eligibilityDraftCount'],
  ]
  for (const [manifestKey, summaryKey] of expected) {
    if (Number(manifest[manifestKey]) !== Number(summary[summaryKey])) {
      throw new Error(`Manifest count mismatch for ${manifestKey}: ${manifest[manifestKey]} !== ${summary[summaryKey]}`)
    }
  }
}

function buildTaskIndex(tasks) {
  return new Set(tasks.map((task) => [
    task.program_name,
    task.round_name,
    task.field_name,
  ].join('\u0000')))
}

function reviewTaskKey(round, field) {
  return [
    round.program_name,
    round.round_name,
    field,
  ].join('\u0000')
}

function findReviewTaskIdsForField(tasks, round, field, taskIndex) {
  return (REVIEW_TASK_FIELD_ALIASES[field] || [field])
    .filter((taskField) => taskIndex.has(reviewTaskKey(round, taskField)))
    .flatMap((taskField) => tasks
      .filter((task) =>
        task.program_name === round.program_name
        && task.round_name === round.round_name
        && task.field_name === taskField,
      )
      .map((task) => task.task_id))
}

function programIdForRound(round) {
  const basis = `${round.issuer || ''}\u0000${round.program_name || ''}`
  return `program_${crypto.createHash('sha1').update(basis).digest('hex').slice(0, 12)}`
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'))
}

async function readJsonl(filePath) {
  const raw = await fs.readFile(filePath, 'utf8')
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line))
}

async function readCsv(filePath) {
  const raw = await fs.readFile(filePath, 'utf8')
  const rows = parseCsv(raw)
  if (rows.length === 0) return []
  const headers = rows[0].map((header) => stripBom(header).trim())
  return rows.slice(1)
    .filter((row) => row.some((cell) => String(cell || '').trim() !== ''))
    .map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ''])))
}

export function parseCsv(raw) {
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false

  for (let index = 0; index < raw.length; index += 1) {
    const char = raw[index]
    const next = raw[index + 1]
    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"'
        index += 1
      } else if (char === '"') {
        inQuotes = false
      } else {
        field += char
      }
    } else if (char === '"') {
      inQuotes = true
    } else if (char === ',') {
      row.push(field)
      field = ''
    } else if (char === '\n') {
      row.push(stripCr(field))
      rows.push(row)
      row = []
      field = ''
    } else {
      field += char
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(stripCr(field))
    rows.push(row)
  }
  return rows
}

function stripBom(value) {
  return String(value || '').replace(/^\uFEFF/, '')
}

function stripCr(value) {
  return String(value || '').replace(/\r$/, '')
}

function arrayOrEmpty(value) {
  return Array.isArray(value) ? value : []
}

function booleanOrNull(value) {
  if (value === true || value === false) return value
  if (value === 'true') return true
  if (value === 'false') return false
  return null
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function isMissing(value) {
  return value === null || value === undefined || value === ''
}

function assertUnique(values, label) {
  const seen = new Set()
  const duplicates = []
  for (const value of values) {
    if (!value) throw new Error(`Missing ${label}`)
    if (seen.has(value)) duplicates.push(value)
    seen.add(value)
  }
  if (duplicates.length > 0) {
    throw new Error(`Duplicate ${label}: ${duplicates.join(', ')}`)
  }
}

function dedupeBy(items, key) {
  const map = new Map()
  for (const item of items) {
    if (!item) continue
    const value = item[key]
    if (!value) continue
    map.set(value, item)
  }
  return Array.from(map.values())
}

function parseArgs(argv) {
  const options = {
    inputDir: DEFAULT_PACK_DIR,
    outputPath: DEFAULT_OUTPUT_PATH,
    dryRun: false,
    json: false,
  }
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--input') {
      options.inputDir = path.resolve(argv[++index])
    } else if (arg === '--output') {
      options.outputPath = path.resolve(argv[++index])
    } else if (arg === '--dry-run') {
      options.dryRun = true
    } else if (arg === '--json') {
      options.json = true
    } else {
      throw new Error(`Unknown argument: ${arg}`)
    }
  }
  return options
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  if (options.dryRun) {
    const store = await buildSeedDraftStore({ inputDir: options.inputDir })
    if (options.json) {
      process.stdout.write(`${JSON.stringify({
        mode: 'dry_run',
        mutation: 'none',
        outputPath: null,
        summary: store.summary,
      }, null, 2)}\n`)
    } else {
      console.log(`seed draft import dry-run: ${store.summary.roundDraftCount} round drafts, ${store.summary.reviewTaskCount} review tasks, 0 canonical writes`)
    }
    return
  }

  const { outputPath, store } = await writeSeedDraftStore(options)
  if (options.json) {
    process.stdout.write(`${JSON.stringify({
      mode: 'write_runtime_draft_store',
      mutation: 'runtime_draft_store_only',
      outputPath,
      summary: store.summary,
    }, null, 2)}\n`)
  } else {
    console.log(`seed draft import wrote ${outputPath}`)
    console.log(`${store.summary.roundDraftCount} round drafts, ${store.summary.reviewTaskCount} review tasks, 0 canonical writes`)
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.stack || error.message)
    process.exit(1)
  })
}
