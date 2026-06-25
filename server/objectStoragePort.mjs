import crypto from 'node:crypto'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { exportDir } from './utils.mjs'

export const OBJECT_STORAGE_PORT_METHODS = Object.freeze([
  'putObject',
  'getObject',
  'signGetUrl',
  'verifySignedUrl',
  'deleteObject',
  'cleanupPrefix',
])

export function assertObjectStoragePort(port) {
  for (const method of OBJECT_STORAGE_PORT_METHODS) {
    if (typeof port?.[method] !== 'function') {
      throw new TypeError(`Missing ObjectStoragePort method: ${method}`)
    }
  }
  return port
}

export class LocalObjectStorageAdapter {
  constructor({
    baseDir = exportDir,
    publicPrefix = '/exports',
    signingSecret = process.env.EXPORT_SIGNING_SECRET || 'local-dev-export-signing-secret',
  } = {}) {
    this.baseDir = baseDir
    this.publicPrefix = publicPrefix.replace(/\/$/, '')
    this.signingSecret = signingSecret
  }

  async putObject({ key, body, contentType, metadata = {} }) {
    const safeKey = validateStorageKey(key)
    const buffer = Buffer.isBuffer(body) ? body : Buffer.from(body || '')
    const filePath = this.localPath(safeKey)
    await fs.mkdir(path.dirname(filePath), { recursive: true })
    await fs.writeFile(filePath, buffer)
    return {
      key: safeKey,
      contentType: contentType || contentTypeForKey(safeKey),
      sizeBytes: buffer.length,
      checksum: sha256(buffer),
      metadata,
    }
  }

  async getObject({ key }) {
    const safeKey = validateStorageKey(key)
    const body = await fs.readFile(this.localPath(safeKey))
    return {
      key: safeKey,
      body,
      contentType: contentTypeForKey(safeKey),
      sizeBytes: body.length,
      checksum: sha256(body),
    }
  }

  signGetUrl({ key, userId, expiresAt }) {
    const safeKey = validateStorageKey(key)
    const expiresMs = expiryMs(expiresAt)
    const user = String(userId || '')
    if (!user) throw new Error('userId is required to sign export URL')
    const signature = this.sign({ key: safeKey, userId: user, expiresMs })
    const token = [
      String(expiresMs),
      base64UrlEncode(user),
      signature,
    ].join('.')
    return `${this.publicPrefix}/${encodeURIComponent(safeKey)}?token=${encodeURIComponent(token)}`
  }

  verifySignedUrl({ key, userId, token, now = new Date() }) {
    const safeKey = validateStorageKey(key)
    const user = String(userId || '')
    const parts = String(token || '').split('.')
    if (parts.length !== 3 || !user) return false
    const [expiresText, encodedUser, signature] = parts
    const expiresMs = Number(expiresText)
    if (!Number.isFinite(expiresMs) || expiresMs <= new Date(now).getTime()) return false
    if (base64UrlDecode(encodedUser) !== user) return false
    const expected = this.sign({ key: safeKey, userId: user, expiresMs })
    return timingSafeEqual(signature, expected)
  }

  async deleteObject({ key }) {
    const safeKey = validateStorageKey(key)
    await fs.rm(this.localPath(safeKey), { force: true })
  }

  async cleanupPrefix({ prefix = '' } = {}) {
    const safePrefix = prefix ? validateStorageKey(prefix).replace(/\/?$/, '/') : ''
    const removed = []
    await fs.mkdir(this.baseDir, { recursive: true })
    for (const entry of await fs.readdir(this.baseDir)) {
      if (safePrefix && !entry.startsWith(safePrefix)) continue
      await fs.rm(this.localPath(entry), { recursive: true, force: true })
      removed.push(entry)
    }
    return { removedCount: removed.length, removed }
  }

  sign({ key, userId, expiresMs }) {
    return crypto
      .createHmac('sha256', this.signingSecret)
      .update(`${key}\n${userId}\n${expiresMs}`)
      .digest('base64url')
  }

  localPath(key) {
    const safeKey = validateStorageKey(key)
    const resolved = path.resolve(this.baseDir, safeKey)
    const base = path.resolve(this.baseDir)
    if (resolved !== base && !resolved.startsWith(`${base}${path.sep}`)) {
      throw Object.assign(new Error('Invalid storage key'), { code: 'INVALID_STORAGE_KEY' })
    }
    return resolved
  }
}

export const defaultObjectStoragePort = assertObjectStoragePort(new LocalObjectStorageAdapter())

export function validateStorageKey(key) {
  const value = String(key || '').trim()
  if (!value || value.length > 240 || value.includes('\\') || value.includes('\0')) {
    throw Object.assign(new Error('Invalid storage key'), { code: 'INVALID_STORAGE_KEY' })
  }
  if (value.startsWith('/') || value.split('/').some((part) => !part || part === '.' || part === '..')) {
    throw Object.assign(new Error('Invalid storage key'), { code: 'INVALID_STORAGE_KEY' })
  }
  return value
}

export function contentTypeForKey(key) {
  const ext = path.extname(String(key)).toLowerCase()
  if (ext === '.pdf') return 'application/pdf'
  if (ext === '.docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  return 'application/octet-stream'
}

function expiryMs(expiresAt) {
  const ms = new Date(expiresAt).getTime()
  if (!Number.isFinite(ms)) throw new Error('expiresAt is required to sign export URL')
  return ms
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex')
}

function base64UrlEncode(value) {
  return Buffer.from(String(value), 'utf8').toString('base64url')
}

function base64UrlDecode(value) {
  try {
    return Buffer.from(String(value), 'base64url').toString('utf8')
  } catch {
    return ''
  }
}

function timingSafeEqual(a, b) {
  const left = Buffer.from(String(a))
  const right = Buffer.from(String(b))
  return left.length === right.length && crypto.timingSafeEqual(left, right)
}
