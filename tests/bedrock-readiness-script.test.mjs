import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import test from 'node:test'

test('Bedrock readiness script documents safe manual AWS switches', async () => {
  const help = execFileSync(process.execPath, ['scripts/bedrock-readiness.mjs', '--help'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  })

  assert.match(help, /Read-only by default/)
  assert.match(help, /--submit-use-case/)
  assert.match(help, /--create-agreement/)
  assert.match(help, /--smoke/)
  assert.match(help, /BEDROCK_MODEL_ID=apac\.anthropic\.claude-3-5-sonnet-20241022-v2:0/)
})

test('Bedrock staging docs point to the readiness script and cost guardrails', async () => {
  const docs = await fs.readFile(path.join(process.cwd(), 'docs/bedrock-llm-cost-control.md'), 'utf8')
  assert.match(docs, /npm run bedrock:preflight/)
  assert.match(docs, /npm run bedrock:smoke/)
  assert.match(docs, /LLM_DAILY_BUDGET_USD=5/)
  assert.match(docs, /apac\.anthropic\.claude-3-5-sonnet-20241022-v2:0/)
})
