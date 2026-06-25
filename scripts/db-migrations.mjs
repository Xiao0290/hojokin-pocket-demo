#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import crypto from 'node:crypto'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const MIGRATION_DIR = 'db/migrations'

export const MIGRATION_REQUIRED_TABLES = Object.freeze({
  schema_migrations: ['version', 'name', 'checksum', 'applied_at'],
  users: ['id', 'email', 'display_name', 'role', 'created_at', 'updated_at'],
  organizations: ['id', 'name', 'created_at', 'updated_at'],
  organization_memberships: ['id', 'user_id', 'organization_id', 'role', 'created_at'],
  companies: ['id', 'user_id', 'organization_id', 'url', 'name', 'profile_json', 'citations_json', 'unknowns_json', 'created_at', 'updated_at'],
  diagnoses: ['id', 'user_id', 'organization_id', 'company_id', 'status', 'progress', 'events_json', 'result_json', 'created_at', 'updated_at'],
  source_registry: ['id', 'name', 'base_url', 'license_status', 'commercial_use', 'redistribution', 'terms_url', 'created_at', 'updated_at'],
  source_records: ['id', 'registry_source_id', 'external_id', 'source_url', 'content_hash', 'raw_ref', 'fetched_at', 'last_seen_at', 'review_status', 'published_at', 'created_at', 'updated_at'],
  subsidy_programs: ['id', 'name', 'issuer', 'issuer_type', 'overview', 'source_url', 'status', 'source_record_id', 'created_at', 'updated_at'],
  subsidy_rounds: ['id', 'program_id', 'round_label', 'status', 'accept_start', 'accept_end', 'max_limit', 'subsidy_rate', 'last_seen_at', 'requirements_json', 'documents_json', 'steps_json', 'source_record_id', 'created_at', 'updated_at'],
  subsidy_matches: ['id', 'user_id', 'organization_id', 'diagnosis_id', 'round_id', 'rank', 'score', 'eligible', 'reasons_json', 'warnings_json', 'provenance_json', 'created_at'],
  applicant_confirmations: ['id', 'user_id', 'organization_id', 'diagnosis_id', 'round_id', 'answers_json', 'status', 'created_at', 'updated_at'],
  business_plans: ['id', 'user_id', 'organization_id', 'company_id', 'diagnosis_id', 'round_id', 'status', 'provenance_json', 'sections_json', 'created_at', 'updated_at'],
  exported_files: ['id', 'user_id', 'organization_id', 'plan_id', 'format', 'storage_key', 'filename', 'mime_type', 'size_bytes', 'checksum', 'file_url', 'disclaimer_text', 'expires_at', 'created_at'],
  consent_records: ['id', 'user_id', 'organization_id', 'kind', 'version', 'granted_at', 'metadata_json', 'created_at'],
  lead_requests: ['id', 'user_id', 'organization_id', 'expert_id', 'round_id', 'status', 'consent_record_id', 'payload_json', 'created_at', 'updated_at'],
  notification_settings: ['id', 'user_id', 'organization_id', 'push_enabled', 'email_enabled', 'deadline_enabled', 'updated_at'],
  source_extraction_runs: ['id', 'registry_source_id', 'status', 'started_at', 'finished_at', 'stats_json', 'error_json'],
  source_field_citations: ['id', 'source_record_id', 'field_name', 'citation_url', 'quote_hash', 'confidence', 'created_at'],
  source_review_decisions: ['id', 'source_record_id', 'reviewer_user_id', 'decision', 'notes', 'created_at'],
  audit_logs: ['id', 'user_id', 'organization_id', 'actor_type', 'event', 'target_type', 'target_id', 'payload_json', 'correlation_id', 'created_at'],
})

export async function listMigrations(rootDir = projectRoot()) {
  const migrationDir = path.join(rootDir, MIGRATION_DIR)
  const entries = await fs.readdir(migrationDir)
  const migrations = []
  for (const name of entries.filter((entry) => entry.endsWith('.sql')).sort()) {
    if (!/^\d{4}_[a-z0-9_]+\.sql$/.test(name)) {
      throw new Error(`Invalid migration filename: ${name}`)
    }
    const filePath = path.join(migrationDir, name)
    const sql = await fs.readFile(filePath, 'utf8')
    migrations.push({
      version: name.slice(0, 4),
      name,
      path: filePath,
      checksum: crypto.createHash('sha256').update(sql).digest('hex'),
      sql,
    })
  }
  return migrations
}

export async function validateMigrations(rootDir = projectRoot()) {
  const migrations = await listMigrations(rootDir)
  const errors = []
  if (migrations.length === 0) {
    errors.push('At least one migration is required.')
  }
  const versions = new Set()
  for (const migration of migrations) {
    if (versions.has(migration.version)) {
      errors.push(`Duplicate migration version: ${migration.version}`)
    }
    versions.add(migration.version)
  }

  const sql = migrations.map((migration) => migration.sql).join('\n')
  const tables = extractCreateTables(sql)
  for (const [table, requiredColumns] of Object.entries(MIGRATION_REQUIRED_TABLES)) {
    if (!tables[table]) {
      errors.push(`Missing required table: ${table}`)
      continue
    }
    for (const column of requiredColumns) {
      if (!tables[table].has(column)) {
        errors.push(`Missing required column: ${table}.${column}`)
      }
    }
  }

  return {
    passed: errors.length === 0,
    errors,
    migrations: migrations.map(({ version, name, checksum }) => ({ version, name, checksum })),
    tableCount: Object.keys(tables).length,
    requiredTableCount: Object.keys(MIGRATION_REQUIRED_TABLES).length,
  }
}

export function renderMigrationReport(result) {
  const lines = [
    'Hojokin Pocket DB migration validation',
    `Overall: ${result.passed ? 'PASS' : 'FAIL'}`,
    `Migrations: ${result.migrations.length}`,
    `Required tables: ${result.requiredTableCount}`,
    `Discovered tables: ${result.tableCount}`,
  ]
  for (const migration of result.migrations) {
    lines.push(`- ${migration.version} ${migration.name} ${migration.checksum.slice(0, 12)}`)
  }
  for (const error of result.errors) {
    lines.push(`ERROR ${error}`)
  }
  return lines.join('\n')
}

async function main() {
  const mode = process.argv.find((arg) => arg.startsWith('--')) || '--validate'
  const result = await validateMigrations()
  console.log(renderMigrationReport(result))
  if (!result.passed) process.exit(1)

  if (mode === '--validate') {
    console.log('Migration validation passed.')
    return
  }
  if (mode === '--seed') {
    await maybeRunSeedCommand()
    return
  }
  if (mode === '--migrate') {
    await maybeRunMutableDbCommand('migrate')
    return
  }
  if (mode === '--reset') {
    await maybeRunMutableDbCommand('reset')
    return
  }
  throw new Error(`Unknown migration mode: ${mode}`)
}

async function maybeRunMutableDbCommand(action) {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.log(`DATABASE_URL is not set; ${action} validated the migration plan only. No database was mutated.`)
    return
  }
  assertLocalDatabaseUrl(databaseUrl)
  if (action === 'reset' && process.env.ALLOW_DB_RESET !== '1') {
    throw new Error('Refusing to reset a database unless ALLOW_DB_RESET=1 is set.')
  }
  if (process.env.ALLOW_DB_MUTATION !== '1') {
    throw new Error('Refusing to mutate a database unless ALLOW_DB_MUTATION=1 is set.')
  }
  const psql = spawnSync('psql', ['--version'], { encoding: 'utf8' })
  if (psql.status !== 0) {
    throw new Error('psql CLI is required for mutable local DB commands.')
  }
  const migrations = await listMigrations()
  await applyMigrations(databaseUrl, migrations, { reset: action === 'reset' })
  console.log(`Applied ${migrations.length} migration(s) to the configured local database.`)
}

async function maybeRunSeedCommand() {
  if ((process.env.STORE_BACKEND || 'local').toLowerCase() !== 'postgres') {
    console.log('STORE_BACKEND is local; seed validated the migration plan only. No database was mutated.')
    return
  }
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required when STORE_BACKEND=postgres.')
  }
  assertLocalDatabaseUrl(databaseUrl)
  if (process.env.ALLOW_DB_MUTATION !== '1') {
    throw new Error('Refusing to seed a database unless ALLOW_DB_MUTATION=1 is set.')
  }
  const { defaultStoreRepository } = await import('../server/storeRepository.mjs')
  await defaultStoreRepository.reset()
  await defaultStoreRepository.close?.()
  console.log('Seeded the configured local Postgres database with Closed Beta alpha demo data.')
}

function assertLocalDatabaseUrl(value) {
  const url = new URL(value)
  const localHosts = new Set(['localhost', '127.0.0.1', '::1'])
  if (!localHosts.has(url.hostname) && process.env.ALLOW_REMOTE_DB !== '1') {
    throw new Error('Refusing to use a non-local DATABASE_URL without ALLOW_REMOTE_DB=1.')
  }
}

async function applyMigrations(databaseUrl, migrations, { reset = false } = {}) {
  if (reset) {
    runPsql(databaseUrl, 'DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;')
  }
  for (const migration of migrations) {
    runPsql(databaseUrl, [
      'BEGIN;',
      migration.sql,
      `INSERT INTO schema_migrations (version, name, checksum) VALUES (${sqlLiteral(migration.version)}, ${sqlLiteral(migration.name)}, ${sqlLiteral(migration.checksum)})`,
      'ON CONFLICT (version) DO UPDATE SET name = EXCLUDED.name, checksum = EXCLUDED.checksum, applied_at = now();',
      'COMMIT;',
    ].join('\n'))
  }
}

function runPsql(databaseUrl, sql) {
  const result = spawnSync('psql', ['--no-psqlrc', '--quiet', '--set=ON_ERROR_STOP=1'], {
    encoding: 'utf8',
    env: { ...process.env, ...postgresEnv(databaseUrl) },
    input: sql,
  })
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || 'psql failed')
  }
}

function postgresEnv(value) {
  const url = new URL(value)
  return {
    PGHOST: url.hostname,
    PGPORT: url.port || '5432',
    PGDATABASE: decodeURIComponent(url.pathname.replace(/^\//, '')),
    PGUSER: decodeURIComponent(url.username || ''),
    PGPASSWORD: decodeURIComponent(url.password || ''),
  }
}

function sqlLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`
}

function extractCreateTables(sql) {
  const tables = {}
  const createTablePattern = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-z_][a-z0-9_]*)\s*\(([\s\S]*?)\);/gi
  let match
  while ((match = createTablePattern.exec(sql))) {
    const [, tableName, body] = match
    tables[tableName] = extractColumns(body)
  }
  const alterTablePattern = /ALTER\s+TABLE\s+([a-z_][a-z0-9_]*)\s+([\s\S]*?);/gi
  while ((match = alterTablePattern.exec(sql))) {
    const [, tableName, body] = match
    if (!tables[tableName]) tables[tableName] = new Set()
    for (const column of extractAlterAddColumns(body)) {
      tables[tableName].add(column)
    }
  }
  return tables
}

function extractColumns(body) {
  const columns = new Set()
  for (const line of body.split(/\r?\n/)) {
    const trimmed = line.trim().replace(/,$/, '')
    if (!trimmed || trimmed.startsWith('--')) continue
    if (/^(PRIMARY|FOREIGN|UNIQUE|CHECK|CONSTRAINT)\b/i.test(trimmed)) continue
    const column = trimmed.match(/^([a-z_][a-z0-9_]*)\b/i)?.[1]
    if (column) columns.add(column)
  }
  return columns
}

function extractAlterAddColumns(body) {
  const columns = []
  const addColumnPattern = /ADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-z_][a-z0-9_]*)\b/gi
  let match
  while ((match = addColumnPattern.exec(body))) {
    columns.push(match[1])
  }
  return columns
}

function projectRoot() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.stack || error.message || error)
    process.exit(1)
  })
}
