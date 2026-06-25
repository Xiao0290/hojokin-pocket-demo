#!/usr/bin/env node
import { spawn } from 'node:child_process'

const countArg = process.argv.find((arg) => /^\d+$/.test(arg))
const count = countArg ? Number(countArg) : Number(process.env.VERIFY_REPEAT_COUNT || 10)

if (!Number.isInteger(count) || count < 1) {
  console.error('Usage: node scripts/verify-repeat.mjs [positive-count]')
  process.exit(1)
}

for (let index = 1; index <= count; index += 1) {
  console.log(`\nverify:ci repeat ${index}/${count}`)
  const code = await run('npm', ['run', 'verify:ci'], {
    ...process.env,
    VERIFY_REPEAT_INDEX: String(index),
  })
  if (code !== 0) {
    console.error(`verify:ci repeat ${index}/${count} failed with exit code ${code}`)
    process.exit(code)
  }
}

console.log(`\nverify:ci passed ${count}/${count} sequential runs`)

function run(command, args, env) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env,
      stdio: 'inherit',
    })
    child.on('exit', (code) => resolve(code ?? 1))
  })
}
