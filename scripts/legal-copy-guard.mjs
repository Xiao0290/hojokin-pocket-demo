#!/usr/bin/env node
import { readdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()

const scanTargets = [
  'README.md',
  'src',
  'server',
  'docs',
]

const ignoredDirs = new Set([
  '.git',
  '.next',
  'dist',
  'node_modules',
])

const ignoredFiles = new Set([
  'docs/MVP_技術仕様.md',
  'docs/リサーチブリーフ.md',
  'docs/補助金ポケット_Phase1_Codex開発要件定義.md',
  'docs/codex-review-issues.md',
  'docs/test-plan.md',
  'docs/roadmap-to-production.md',
  'docs/deep-research-prompt-L2.md',
  'docs/legal-opinion-brief.md',
  'docs/legal-opinion.md',
  'docs/research-answers.md',
])

const ignoredDocNameParts = [
  'MVP_技術仕様',
  'リサーチブリーフ',
  'Phase1_Codex',
  'codex-review-issues',
  'test-plan',
  'roadmap-to-production',
  'deep-research-prompt-L2',
  'legal-opinion-brief',
  'legal-opinion',
  'research-answers',
]

const scannedExtensions = new Set([
  '.cjs',
  '.css',
  '.html',
  '.js',
  '.json',
  '.jsx',
  '.md',
  '.mjs',
  '.ts',
  '.tsx',
])

const forbidden = [
  { pattern: /申請書を?AIで作成|申請書AI作成/u, reason: 'AI must be framed as applicant draft support.' },
  { pattern: /AIが(?:申請|作成|提出)/u, reason: 'The app must not imply AI performs filing or final drafting.' },
  { pattern: /自動提出|jGrantsに提出|申請を提出|提出完了/u, reason: 'Phase 1 has no in-app filing or submission automation.' },
  { pattern: /採択率[^。]{0,12}(?:上が|向上|\d|％|%)/u, reason: 'Avoid adoption-rate claims or company-specific predictions.' },
  { pattern: /あなたの採択率/u, reason: 'Company-specific adoption-rate prediction is out of scope.' },
  { pattern: /(?:^|[^\d])(?:68|89)\s*[%％]|[+＋]21\s*pt/iu, reason: 'Do not show legacy expert uplift figures.' },
  { pattern: /成功報酬/u, reason: 'Phase 1 has no matching payment flow.' },
  { pattern: /完成版の事業計画書/u, reason: 'Drafts require applicant confirmation.' },
  { pattern: /代理申請できます|受任確定|委任契約を開始/u, reason: 'Expert consultation is waitlist-only in Phase 1.' },
]

const positiveAssertions = [
  { file: 'README.md', pattern: /申請準備/u, label: 'README explains preparation scope' },
  { file: 'README.md', pattern: /下書き支援/u, label: 'README frames AI as draft support' },
  { file: 'src/screens/home.jsx', pattern: /自社サイト/u, label: 'UI asks for self-site attestation' },
  { file: 'src/screens/detail.jsx', pattern: /公式サイト/u, label: 'UI keeps official-source confirmation wording' },
  { file: 'server/seedData.mjs', pattern: /申請者ご本人による下書き作成を支援/u, label: 'export disclaimer is present' },
]

async function exists(filePath) {
  try {
    await stat(filePath)
    return true
  } catch {
    return false
  }
}

async function walk(target, files = []) {
  const targetPath = path.join(root, target)
  if (!(await exists(targetPath))) return files
  const targetStat = await stat(targetPath)
  if (targetStat.isFile()) {
    if (isScannedFile(targetPath)) files.push(targetPath)
    return files
  }

  for (const entry of await readdir(targetPath, { withFileTypes: true })) {
    const absolute = path.join(targetPath, entry.name)
    const relative = path.relative(root, absolute)
    if (entry.isDirectory()) {
      if (!ignoredDirs.has(entry.name)) {
        await walk(relative, files)
      }
      continue
    }

    if (entry.isFile() && isScannedFile(absolute)) {
      files.push(absolute)
    }
  }

  return files
}

function isScannedFile(filePath) {
  const relative = path.relative(root, filePath)
  const basename = path.basename(filePath).normalize('NFC')
  return (
    scannedExtensions.has(path.extname(filePath)) &&
    !ignoredFiles.has(relative) &&
    !(relative.startsWith('docs/') && ignoredDocNameParts.some((part) => basename.includes(part)))
  )
}

function findLineNumber(source, index) {
  return source.slice(0, index).split(/\r?\n/).length
}

const files = []
for (const target of scanTargets) {
  await walk(target, files)
}

const findings = []

for (const file of files) {
  const source = await readFile(file, 'utf8')
  for (const item of forbidden) {
    const matches = source.matchAll(new RegExp(item.pattern.source, item.pattern.flags.includes('g') ? item.pattern.flags : `${item.pattern.flags}g`))
    for (const match of matches) {
      findings.push({
        file: path.relative(root, file),
        line: findLineNumber(source, match.index || 0),
        term: match[0],
        reason: item.reason,
      })
    }
  }
}

for (const assertion of positiveAssertions) {
  const filePath = path.join(root, assertion.file)
  const source = (await exists(filePath)) ? await readFile(filePath, 'utf8') : ''
  if (!assertion.pattern.test(source)) {
    findings.push({
      file: assertion.file,
      line: 1,
      term: assertion.label,
      reason: 'Required safe Phase 1 copy is missing.',
    })
  }
}

if (findings.length > 0) {
  console.error(`Legal copy guard found ${findings.length} issue(s):`)
  for (const finding of findings) {
    console.error(`- ${finding.file}:${finding.line} "${finding.term}"`)
    console.error(`  ${finding.reason}`)
  }
  process.exit(1)
}

console.log(`Legal copy guard passed. Scanned ${files.length} file(s).`)
