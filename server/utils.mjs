import { promises as fs } from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import dns from 'node:dns/promises'
import net from 'node:net'

export const rootDir = process.cwd()
export const runtimeDir = process.env.RUNTIME_DIR
  ? path.resolve(process.env.RUNTIME_DIR)
  : path.join(rootDir, 'data/runtime')
export const exportDir = process.env.EXPORT_DIR
  ? path.resolve(process.env.EXPORT_DIR)
  : path.join(rootDir, 'data/exports')

export function id(prefix) {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`
}

export function nowIso() {
  return new Date().toISOString()
}

export async function ensureDirs() {
  await fs.mkdir(runtimeDir, { recursive: true })
  await fs.mkdir(exportDir, { recursive: true })
}

export async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'))
  } catch (error) {
    if (error.code === 'ENOENT') return fallback
    throw error
  }
}

export async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.${crypto.randomUUID()}.tmp`
  await fs.writeFile(tempPath, `${JSON.stringify(value, null, 2)}\n`)
  await fs.rename(tempPath, filePath)
}

export function sendJson(res, status, value) {
  const body = JSON.stringify(value)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'content-type, authorization',
    'access-control-allow-methods': 'GET,POST,PUT,PATCH,OPTIONS',
  })
  res.end(body)
}

export function sendError(res, status, code, message, details = {}) {
  sendJson(res, status, { error: { code, message, details } })
}

export async function readBody(req) {
  const chunks = []
  let bytes = 0
  const maxBytes = Number(process.env.MAX_BODY_BYTES || 1024 * 1024)
  for await (const chunk of req) {
    bytes += chunk.length
    if (bytes > maxBytes) {
      const error = new Error('Request body is too large')
      error.status = 413
      error.code = 'PAYLOAD_TOO_LARGE'
      throw error
    }
    chunks.push(chunk)
  }
  const raw = Buffer.concat(chunks).toString('utf8')
  if (!raw) return {}
  try {
    return JSON.parse(raw)
  } catch {
    const error = new Error('Invalid JSON')
    error.status = 400
    error.code = 'VALIDATION_ERROR'
    throw error
  }
}

export function normalizeCompanyUrl(input) {
  const value = String(input || '').trim()
  if (!value) throw validationError('会社URLを入力してください')
  if (/^[a-z][a-z\d+\-.]*:/i.test(value) && !/^https?:\/\//i.test(value)) {
    throw validationError('このURLは診断に利用できません')
  }
  const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`
  let url
  try {
    url = new URL(withScheme)
  } catch {
    throw validationError('URLの形式を確認してください')
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw validationError('このURLは診断に利用できません')
  }
  if (url.href.length > 2048) {
    throw validationError('URLが長すぎます')
  }
  return url
}

export function validationError(message, details = {}) {
  const error = new Error(message)
  error.status = 400
  error.code = 'VALIDATION_ERROR'
  error.details = details
  return error
}

export function isPrivateIp(address) {
  const family = net.isIP(address)
  if (family === 0) return false
  if (family === 4) {
    const parts = address.split('.').map(Number)
    return (
      parts[0] === 10 ||
      parts[0] === 127 ||
      (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) ||
      (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
      (parts[0] === 192 && parts[1] === 168) ||
      (parts[0] === 169 && parts[1] === 254) ||
      parts[0] === 0 ||
      parts[0] >= 224
    )
  }
  const normalized = address.toLowerCase()
  if (normalized.startsWith('::ffff:')) {
    return isPrivateIp(normalized.slice('::ffff:'.length))
  }
  return (
    normalized === '::1' ||
    normalized === '::' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    normalized.startsWith('fe80:')
  )
}

export async function assertPublicUrl(url) {
  const host = url.hostname.toLowerCase()
  if (host === 'localhost' || host.endsWith('.localhost')) {
    throw validationError('このURLは診断に利用できません', { host })
  }
  if (isPrivateIp(host)) {
    throw validationError('このURLは診断に利用できません', { host })
  }

  try {
    const results = await dns.lookup(host, { all: true })
    if (results.some((entry) => isPrivateIp(entry.address))) {
      throw validationError('このURLは診断に利用できません', { host })
    }
  } catch (error) {
    if (error.code === 'VALIDATION_ERROR') throw error
    // DNS can be unavailable in local dev. Runtime fetch will surface URL_NOT_ACCESSIBLE.
  }
}

export function stripHtml(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function getMeta(html, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const patterns = [
    new RegExp(`<meta[^>]+name=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i'),
    new RegExp(`<meta[^>]+property=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${escaped}["'][^>]*>`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${escaped}["'][^>]*>`, 'i'),
  ]
  for (const pattern of patterns) {
    const match = html.match(pattern)
    if (match) return decodeHtml(match[1])
  }
  return null
}

export function getTitle(html) {
  const match = String(html || '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return match ? decodeHtml(match[1].replace(/\s+/g, ' ').trim()) : null
}

export function decodeHtml(value) {
  return String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

export function daysLeft(acceptEnd, now = new Date()) {
  if (!acceptEnd) return null
  const diff = new Date(acceptEnd).getTime() - now.getTime()
  return Math.max(0, Math.ceil(diff / 86400000))
}
