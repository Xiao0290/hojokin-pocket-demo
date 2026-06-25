import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test, { after } from 'node:test'
import { LocalObjectStorageAdapter, assertObjectStoragePort, validateStorageKey } from '../server/objectStoragePort.mjs'

const testRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'hojokin-object-storage-'))

after(async () => {
  await fs.rm(testRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 })
})

test('LocalObjectStorageAdapter implements port methods and signed URL semantics', async () => {
  const storage = assertObjectStoragePort(new LocalObjectStorageAdapter({
    baseDir: testRoot,
    signingSecret: 'test-secret',
  }))

  const put = await storage.putObject({
    key: 'plan_test.docx',
    body: Buffer.from('docx-body'),
    contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    metadata: { planId: 'plan_test' },
  })
  assert.equal(put.key, 'plan_test.docx')
  assert.equal(put.sizeBytes, 9)
  assert.match(put.checksum, /^[a-f0-9]{64}$/)

  const expiresAt = '2099-01-01T00:00:00.000Z'
  const fileUrl = storage.signGetUrl({ key: put.key, userId: 'user_a', expiresAt })
  const token = new URL(fileUrl, 'http://local.invalid').searchParams.get('token')
  assert.equal(storage.verifySignedUrl({ key: put.key, userId: 'user_a', token, now: '2026-06-20T00:00:00.000Z' }), true)
  assert.equal(storage.verifySignedUrl({ key: put.key, userId: 'user_b', token, now: '2026-06-20T00:00:00.000Z' }), false)
  assert.equal(storage.verifySignedUrl({ key: put.key, userId: 'user_a', token, now: '2100-01-01T00:00:00.000Z' }), false)
  assert.equal(storage.verifySignedUrl({ key: put.key, userId: 'user_a', token: `${token}x`, now: '2026-06-20T00:00:00.000Z' }), false)

  const object = await storage.getObject({ key: put.key })
  assert.equal(object.body.toString('utf8'), 'docx-body')
  assert.equal(object.contentType, put.contentType)
})

test('LocalObjectStorageAdapter rejects path traversal keys', async () => {
  const storage = new LocalObjectStorageAdapter({ baseDir: testRoot })
  for (const key of ['../secret.txt', '/absolute.docx', 'nested/../secret.docx', '']) {
    assert.throws(() => validateStorageKey(key), /Invalid storage key/)
    await assert.rejects(
      () => storage.putObject({ key, body: Buffer.from('x') }),
      /Invalid storage key/,
    )
  }
})
