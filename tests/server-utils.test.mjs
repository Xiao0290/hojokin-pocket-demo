import assert from 'node:assert/strict'
import test from 'node:test'
import { daysLeft, isPrivateIp, normalizeCompanyUrl, readBody } from '../server/utils.mjs'

test('normalizes company URLs with safe default scheme', () => {
  assert.equal(normalizeCompanyUrl('www.sample-corp.example').href, 'https://www.sample-corp.example/')
  assert.equal(normalizeCompanyUrl('https://www.sample-corp.example/ja/').href, 'https://www.sample-corp.example/ja/')
})

test('rejects unsupported URL schemes', () => {
  assert.throws(() => normalizeCompanyUrl('file:///etc/passwd'), /このURLは診断に利用できません/)
})

test('classifies private and reserved IP ranges for SSRF guard', () => {
  assert.equal(isPrivateIp('127.0.0.1'), true)
  assert.equal(isPrivateIp('10.0.0.2'), true)
  assert.equal(isPrivateIp('172.20.0.2'), true)
  assert.equal(isPrivateIp('192.168.1.10'), true)
  assert.equal(isPrivateIp('169.254.169.254'), true)
  assert.equal(isPrivateIp('::1'), true)
  assert.equal(isPrivateIp('::ffff:127.0.0.1'), true)
  assert.equal(isPrivateIp('8.8.8.8'), false)
})

test('computes deadline days without negative values', () => {
  const now = new Date('2026-06-20T00:00:00+09:00')
  assert.equal(daysLeft('2026-06-21T00:00:00+09:00', now), 1)
  assert.equal(daysLeft('2026-06-19T00:00:00+09:00', now), 0)
  assert.equal(daysLeft(null, now), null)
})

test('rejects oversized JSON bodies', async () => {
  const originalLimit = process.env.MAX_BODY_BYTES
  process.env.MAX_BODY_BYTES = '8'
  const request = {
    async *[Symbol.asyncIterator]() {
      yield Buffer.from('{"url":')
      yield Buffer.from('"https://example.com"}')
    },
  }

  try {
    await assert.rejects(() => readBody(request), (error) => {
      assert.equal(error.status, 413)
      assert.equal(error.code, 'PAYLOAD_TOO_LARGE')
      return true
    })
  } finally {
    if (originalLimit === undefined) {
      delete process.env.MAX_BODY_BYTES
    } else {
      process.env.MAX_BODY_BYTES = originalLimit
    }
  }
})
