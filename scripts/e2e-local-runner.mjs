#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { promises as fs } from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'

const allocatedPorts = new Set()
const apiPort = process.env.API_PORT || String(await findFreePort())
const frontendPort = process.env.FRONTEND_PORT || String(await findFreePort())
const apiBaseUrl = process.env.API_BASE_URL || `http://127.0.0.1:${apiPort}`
const frontendBaseUrl = process.env.FRONTEND_BASE_URL || `http://127.0.0.1:${frontendPort}`
const runId = process.env.E2E_RUN_ID || `${Date.now()}`
const needsOwnedTempRoot = !process.env.RUNTIME_DIR || !process.env.EXPORT_DIR
const ownedTempRoot = needsOwnedTempRoot
  ? await fs.mkdtemp(path.join(os.tmpdir(), 'hojokin-pocket-e2e-'))
  : ''
const runtimeDir = process.env.RUNTIME_DIR || path.join(ownedTempRoot, runId, 'runtime')
const exportDir = process.env.EXPORT_DIR || path.join(ownedTempRoot, runId, 'exports')
const children = []
let shuttingDown = false
let earlyExitError = null

main().catch(async (error) => {
  console.error(error.stack || error.message || error)
  await shutdown()
  await cleanupTempRoot()
  process.exit(1)
})

async function main() {
  installSignalHandlers()
  console.log(`E2E runtime dir: ${runtimeDir}`)
  console.log(`E2E export dir: ${exportDir}`)
  start('api', process.execPath, ['server/index.mjs'], {
    ...process.env,
    API_PORT: apiPort,
    RUNTIME_DIR: runtimeDir,
    EXPORT_DIR: exportDir,
    RESET_STORE: process.env.RESET_STORE || '1',
  })
  start('vite', 'npm', ['run', 'dev:web', '--', '--port', frontendPort, '--strictPort'], {
    ...process.env,
    VITE_API_BASE_URL: apiBaseUrl,
  })

  const code = await runForeground('e2e', process.execPath, ['scripts/e2e-phase1-mvp.mjs'], {
    ...process.env,
    API_BASE_URL: apiBaseUrl,
    FRONTEND_BASE_URL: frontendBaseUrl,
    E2E_COMPANY_URL: process.env.E2E_COMPANY_URL || 'https://www.sample-corp.example',
  })

  const exitCode = earlyExitError ? 1 : code
  await shutdown()
  await cleanupTempRoot()
  process.exit(exitCode)
}

function start(label, command, args, env) {
  const child = spawn(command, args, {
    cwd: process.cwd(),
    env,
    detached: process.platform !== 'win32',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  children.push(child)
  pipe(label, child.stdout)
  pipe(label, child.stderr)
  child.on('exit', (code, signal) => {
    if (!shuttingDown) {
      const message = `[${label}] exited early: code=${code ?? ''} signal=${signal || ''}`
      earlyExitError ||= new Error(message)
      console.error(message)
    }
  })
  return child
}

function runForeground(label, command, args, env) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    pipe(label, child.stdout)
    pipe(label, child.stderr)
    child.on('exit', (code) => resolve(code ?? 1))
  })
}

function pipe(label, stream) {
  stream.on('data', (chunk) => {
    for (const line of String(chunk).split(/\r?\n/)) {
      if (line.trim()) console.log(`[${label}] ${line}`)
    }
  })
}

async function shutdown() {
  shuttingDown = true
  for (const child of children) {
    if (!child.killed && child.exitCode === null) {
      killChild(child, 'SIGTERM')
    }
  }
  await new Promise((resolve) => setTimeout(resolve, 500))
  for (const child of children) {
    if (!child.killed && child.exitCode === null) {
      killChild(child, 'SIGKILL')
    }
  }
}

function killChild(child, signal) {
  if (process.platform !== 'win32') {
    try {
      process.kill(-child.pid, signal)
      return
    } catch (error) {
      if (error.code !== 'ESRCH') throw error
    }
  }
  child.kill(signal)
}

async function cleanupTempRoot() {
  if (process.env.E2E_KEEP_RUNTIME === '1' || !ownedTempRoot) return
  await fs.rm(ownedTempRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 })
}

async function findFreePort() {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const port = await reserveEphemeralPort()
    if (!allocatedPorts.has(port)) {
      allocatedPorts.add(port)
      return port
    }
  }
  throw new Error('Unable to allocate a free E2E port')
}

function reserveEphemeralPort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.unref()
    server.on('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      server.close(() => {
        if (!address || typeof address === 'string') {
          reject(new Error('Unable to read allocated E2E port'))
          return
        }
        resolve(address.port)
      })
    })
  })
}

function installSignalHandlers() {
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, async () => {
      await shutdown()
      await cleanupTempRoot()
      process.exit(130)
    })
  }
}
