import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const rootDir = path.resolve(new URL('..', import.meta.url).pathname)
const baselineCommit = 'dd44b39315664ba098460253a674a61324480ea9'

async function read(relativePath) {
  return fs.readFile(path.join(rootDir, relativePath), 'utf8')
}

test('local MVP baseline release notes freeze the current verified commit and limits', async () => {
  const releaseNotes = await read('docs/release-notes/v0.1-local-mvp.md')

  assert.match(releaseNotes, new RegExp(baselineCommit))
  assert.match(releaseNotes, /v0\.3-closed-beta-alpha/)
  assert.match(releaseNotes, /local JSON-backed MVP storage/)
  assert.match(releaseNotes, /not production authentication/)
  assert.match(releaseNotes, /fixture\/source-backed MVP data/)
  assert.match(releaseNotes, /llm: false/)
  assert.match(releaseNotes, /No official filing/)
  assert.match(releaseNotes, /No paid expert marketplace/)
  assert.match(releaseNotes, /success-fee/)
  assert.match(releaseNotes, /v0\.1-local-mvp/)
})

test('local MVP demo script keeps the customer path low-density and solution-first', async () => {
  const script = await read('docs/demo/local-mvp-demo-script.md')

  assert.match(script, new RegExp(baselineCommit))
  assert.match(script, /https:\/\/www\.sample-corp\.example/)
  assert.match(script, /low-density/)
  assert.match(script, /Lead with the number of matching subsidies/)
  assert.match(script, /administrative scrivener/)
  assert.match(script, /must not return a fixed recommendation list/)
  assert.match(script, /deterministic local templates/)
  assert.match(script, /npm run verify:ci/)
})

test('local E2E runner avoids fixed port collisions by default', async () => {
  const runner = await read('scripts/e2e-local-runner.mjs')

  assert.match(runner, /process\.env\.API_PORT \|\| String\(await findFreePort\(\)\)/)
  assert.match(runner, /process\.env\.FRONTEND_PORT \|\| String\(await findFreePort\(\)\)/)
  assert.match(runner, /VITE_API_BASE_URL: apiBaseUrl/)
  assert.match(runner, /function reserveEphemeralPort\(\)/)
})
