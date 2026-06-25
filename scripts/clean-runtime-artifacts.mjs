#!/usr/bin/env node
import { promises as fs } from 'node:fs'
import path from 'node:path'

const rootDir = process.cwd()
const generatedDirs = [
  path.join(rootDir, 'data/runtime'),
  path.join(rootDir, 'data/exports'),
]

for (const dir of generatedDirs) {
  await fs.rm(dir, { recursive: true, force: true })
  console.log(`removed ${path.relative(rootDir, dir)}`)
}
