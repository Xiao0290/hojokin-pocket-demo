import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import {
  MIGRATION_REQUIRED_TABLES,
  listMigrations,
  renderMigrationReport,
  validateMigrations,
} from '../scripts/db-migrations.mjs'

const rootDir = path.resolve(new URL('..', import.meta.url).pathname)

async function read(relativePath) {
  return fs.readFile(path.join(rootDir, relativePath), 'utf8')
}

test('database migration foundation defines Closed Beta alpha persistence tables', async () => {
  const result = await validateMigrations(rootDir)

  assert.equal(result.passed, true, result.errors.join('\n'))
  assert.deepEqual(result.errors, [])
  assert.equal(result.migrations.length, 2)
  assert.equal(result.migrations[0].name, '0001_initial_schema.sql')
  assert.equal(result.migrations[1].name, '0002_export_storage_metadata.sql')
  assert.match(result.migrations[0].checksum, /^[a-f0-9]{64}$/)
  assert.equal(result.requiredTableCount, Object.keys(MIGRATION_REQUIRED_TABLES).length)
  assert.ok(result.tableCount >= result.requiredTableCount)

  for (const table of [
    'users',
    'organizations',
    'organization_memberships',
    'diagnoses',
    'subsidy_rounds',
    'business_plans',
    'exported_files',
    'consent_records',
    'lead_requests',
    'source_records',
    'source_field_citations',
    'source_review_decisions',
    'audit_logs',
  ]) {
    assert.ok(MIGRATION_REQUIRED_TABLES[table], `${table} should be part of the migration contract`)
  }
})

test('database migration CLI validates read-only migration plan', () => {
  const result = spawnSync(process.execPath, ['scripts/db-migrations.mjs', '--validate'], {
    cwd: rootDir,
    encoding: 'utf8',
  })

  assert.equal(result.status, 0, result.stderr || result.stdout)
  assert.match(result.stdout, /Hojokin Pocket DB migration validation/)
  assert.match(result.stdout, /Overall: PASS/)
  assert.match(result.stdout, /Migration validation passed/)
})

test('database scripts and local Docker service are documented without enabling production DB by default', async () => {
  const packageJson = JSON.parse(await read('package.json'))
  const compose = await read('docker-compose.yml')
  const docs = await read('docs/database-migrations.md')

  assert.equal(packageJson.scripts['db:validate'], 'node scripts/db-migrations.mjs --validate')
  assert.equal(packageJson.scripts['db:migrate'], 'node scripts/db-migrations.mjs --migrate')
  assert.equal(packageJson.scripts['db:reset'], 'node scripts/db-migrations.mjs --reset')
  assert.equal(packageJson.scripts['db:seed'], 'node scripts/db-migrations.mjs --seed')
  assert.ok(packageJson.scripts['verify:ci'].includes('db:validate'))

  assert.match(compose, /postgres:16-alpine/)
  assert.match(compose, /54329:5432/)
  assert.match(compose, /hojokin_local_only/)

  assert.match(docs, /STORE_BACKEND=local/)
  assert.match(docs, /STORE_BACKEND=postgres/)
  assert.match(docs, /ALLOW_DB_MUTATION=1/)
  assert.match(docs, /ALLOW_DB_RESET=1/)
  assert.match(docs, /No production DB credentials/)
  assert.match(docs, /No jGrants POST/)
})

test('database seed command is inert unless postgres backend is explicitly selected', () => {
  const result = spawnSync(process.execPath, ['scripts/db-migrations.mjs', '--seed'], {
    cwd: rootDir,
    encoding: 'utf8',
    env: { ...process.env, STORE_BACKEND: 'local' },
  })

  assert.equal(result.status, 0, result.stderr || result.stdout)
  assert.match(result.stdout, /STORE_BACKEND is local/)
  assert.match(result.stdout, /No database was mutated/)
})

test('postgres seed command fails fast without database config', () => {
  const result = spawnSync(process.execPath, ['scripts/db-migrations.mjs', '--seed'], {
    cwd: rootDir,
    encoding: 'utf8',
    env: { ...process.env, STORE_BACKEND: 'postgres', DATABASE_URL: '' },
  })

  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /DATABASE_URL is required/)
})

test('migration listing enforces deterministic ordering and version metadata', async () => {
  const migrations = await listMigrations(rootDir)
  const report = renderMigrationReport(await validateMigrations(rootDir))

  assert.deepEqual(migrations.map((migration) => migration.version), ['0001', '0002'])
  assert.equal(migrations[0].name, '0001_initial_schema.sql')
  assert.equal(migrations[1].name, '0002_export_storage_metadata.sql')
  assert.match(report, /0001 0001_initial_schema\.sql/)
  assert.match(report, /0002 0002_export_storage_metadata\.sql/)
})
