#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { buildSourceRefreshSummary, currentJstDate } from '../server/sourceRefresh.mjs'

const args = parseArgs(process.argv.slice(2))
const fixturePath = args.fixture || 'data/fixtures/subsidy-programs.json'
const outputPath = args.output || 'tmp/source-refresh-dry-run.json'
const today = args.today || currentJstDate()

const fixture = JSON.parse(await readFile(fixturePath, 'utf8'))
const programs = Array.isArray(fixture.programs) ? fixture.programs : []
const results = programs.map((program) => buildSourceRefreshSummary(program, { today }))
const validation = validateFixture(fixture, results)

const report = {
  generatedAt: new Date().toISOString(),
  mode: 'dry-run',
  fixturePath,
  today,
  mutation: 'none',
  licenseGate: 'docs/source-license-registry.md',
  summary: {
    programCount: results.length,
    changedContentHashes: results.filter((item) => item.contentHashChanged).length,
    staleSources: results.filter((item) => item.stale).length,
    open: results.filter((item) => item.statusGroup === 'open').length,
    closed: results.filter((item) => item.statusGroup === 'closed').length,
    announced: results.filter((item) => item.statusGroup === 'announced').length,
    manualSources: results.filter((item) => item.sourceRecord.automationMode === 'manual').length,
    automatedSources: results.filter((item) => item.sourceRecord.automationMode === 'automated').length,
  },
  validation,
  results: results.map((item) => ({
    roundId: item.roundId,
    program: item.program,
    round: item.round,
    status: item.status,
    statusGroup: item.statusGroup,
    sourceUrl: item.sourceUrl,
    lastSeenAt: item.lastSeenAt,
    stale: item.stale,
    staleDays: item.staleDays,
    contentHash: item.contentHash,
    previousContentHash: item.previousContentHash,
    contentHashChanged: item.contentHashChanged,
    evidenceSupport: {
      count: item.evidenceSupport.count,
      supportedFields: item.evidenceSupportedFields,
      missingFields: item.evidenceMissingFields,
      complete: item.evidenceSupport.complete,
    },
    sourceRecord: item.sourceRecord,
    gate: item.gate,
    warning: item.warning,
  })),
}

await mkdir(path.dirname(outputPath), { recursive: true })
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`)
printReport(report, outputPath)

if (validation.errors.length > 0) {
  process.exitCode = 1
}

function validateFixture(fixture, results) {
  const errors = []
  const warnings = []
  if (fixture.fixtureType !== 'development-only') {
    errors.push('fixtureType must remain development-only')
  }
  if (programs.length === 0) {
    errors.push('programs[] must not be empty')
  }
  for (const item of results) {
    if (!item.sourceUrl?.startsWith('https://')) errors.push(`${item.roundId}: sourceUrl must be https`)
    if (!item.lastSeenAt) errors.push(`${item.roundId}: lastSeenAt is required`)
    if (!item.previousContentHash) errors.push(`${item.roundId}: sourceRecord.contentHash is required`)
    if (item.sourceRecord.licenseStatus === 'blocked') errors.push(`${item.roundId}: blocked source cannot be used even as fixture metadata`)
    if (item.sourceRecord.licenseStatus === 'unresolved') warnings.push(`${item.roundId}: unresolved source remains manual/link-only`)
    if (item.sourceRecord.automationMode !== 'manual') warnings.push(`${item.roundId}: automated mode needs source-specific license review`)
    if (!item.evidenceSupport.complete) {
      warnings.push(`${item.roundId}: evidence does not support ${item.evidenceMissingFields.join(', ')}`)
    }
    if (item.gate.productionEtlAllowed) {
      errors.push(`${item.roundId}: dry-run gate must not allow production ETL`)
    }
  }
  return { ok: errors.length === 0, errors, warnings }
}

function parseArgs(values) {
  const parsed = {}
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index]
    if (!value.startsWith('--')) continue
    const key = value.slice(2)
    const next = values[index + 1]
    if (!next || next.startsWith('--')) {
      parsed[key] = true
    } else {
      parsed[key] = next
      index += 1
    }
  }
  return parsed
}

function printReport(report, outputPath) {
  console.log(`source refresh dry-run: ${report.summary.programCount} programs, artifact ${outputPath}`)
  console.log(`changed content_hash: ${report.summary.changedContentHashes}`)
  console.log(`states: open=${report.summary.open} closed=${report.summary.closed} announced=${report.summary.announced} stale=${report.summary.staleSources}`)
  for (const item of report.results) {
    const changed = item.contentHashChanged ? 'changed' : 'unchanged'
    const evidence = item.evidenceSupport.complete ? 'supported' : `missing:${item.evidenceSupport.missingFields.join('|')}`
    console.log(`${item.roundId}: ${item.statusGroup} ${changed} stale=${item.stale} lastSeenAt=${item.lastSeenAt} sourceUrl=${item.sourceUrl} evidence=${evidence}`)
  }
  if (report.validation.warnings.length > 0) {
    console.log(`warnings: ${report.validation.warnings.length}`)
  }
}
