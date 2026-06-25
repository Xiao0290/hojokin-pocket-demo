import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const rootDir = path.resolve(new URL('..', import.meta.url).pathname)
const pauseLines = [
  /marketplace/,
  /success-fee/,
  /platform take-rate/,
  /proxy drafting\/submission/,
  /jGrants POST/,
  /production `SubmissionAdapter`/,
]

async function read(relativePath) {
  return fs.readFile(path.join(rootDir, relativePath), 'utf8')
}

test('v0.2 alpha foundation release note documents Gate B acceptance evidence', async () => {
  const release = await read('docs/release-notes/v0.2-alpha-foundation.md')

  assert.match(release, /Gate B \/ M1-08 Alpha foundation/)
  assert.match(release, /Postgres adapter/)
  assert.match(release, /Users, organizations, memberships/)
  assert.match(release, /AuthContext/)
  assert.match(release, /Tenant scope/)
  assert.match(release, /ObjectStoragePort/)
  assert.match(release, /Audit logs/)
  assert.match(release, /npm run verify:ci/)
  assert.match(release, /GitHub Actions `verify` passes/)
  assert.match(release, /SAMPLE E2E path/)
  assert.match(release, /8\.5 \/ 10/)
  for (const line of pauseLines) assert.match(release, line)
})

test('alpha foundation runbooks cover auth and export operational boundaries', async () => {
  const auth = await read('docs/runbooks/auth-boundary.md')
  const exportStorage = await read('docs/runbooks/export-storage.md')

  assert.match(auth, /APP_ENV=closed-beta/)
  assert.match(auth, /real AuthProvider/)
  assert.match(auth, /tenant negative tests/)
  assert.match(auth, /admin source-review/)
  for (const line of pauseLines) assert.match(auth, line)

  assert.match(exportStorage, /LocalObjectStorageAdapter/)
  assert.match(exportStorage, /EXPORT_SIGNING_SECRET/)
  assert.match(exportStorage, /file\.downloaded/)
  assert.match(exportStorage, /do not log signed tokens/)
  assert.match(exportStorage, /404 NOT_FOUND/)
  for (const line of pauseLines) assert.match(exportStorage, line)
})

test('README exposes local Postgres and beta foundation verification notes', async () => {
  const readme = await read('README.md')

  assert.match(readme, /Alpha Foundation/)
  assert.match(readme, /docker compose up -d postgres/)
  assert.match(readme, /STORE_BACKEND=postgres/)
  assert.match(readme, /ALLOW_DB_MUTATION=1/)
  assert.match(readme, /docs\/release-notes\/v0\.2-alpha-foundation\.md/)
  assert.match(readme, /docs\/runbooks\/auth-boundary\.md/)
  assert.match(readme, /docs\/runbooks\/export-storage\.md/)
})
