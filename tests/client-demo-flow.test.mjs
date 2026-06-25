import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const rootDir = path.resolve(new URL('..', import.meta.url).pathname)

async function read(relativePath) {
  return fs.readFile(path.join(rootDir, relativePath), 'utf8')
}

test('client shell is responsive instead of a simulated phone by default', async () => {
  const app = await read('src/App.jsx')
  const styles = await read('src/styles.css')

  assert.equal(app.includes('PhoneFrame'), false)
  assert.match(app, /app-shell-responsive/)
  assert.match(styles, /\.app-shell-responsive/)
  assert.match(styles, /@media \(max-width: 760px\)/)
  assert.match(styles, /@media \(min-width: 760px\)/)
})

test('customer demo flow leads with numbers and administrative-scrivener solution path', async () => {
  const diagnose = await read('src/screens/diagnose.jsx')
  const detail = await read('src/screens/detail.jsx')
  const styles = await read('src/styles.css')

  assert.match(diagnose, /上限合計/)
  assert.match(diagnose, /行政書士相談へ進む/)
  assert.match(diagnose, /solution-panel/)
  assert.match(diagnose, /result-money-hero/)
  assert.match(diagnose, /candidate-details/)
  assert.match(diagnose, /読み取った会社情報と条件を確認する/)
  assert.match(styles, /scanBeam/)
  assert.match(styles, /solution-step/)
  assert.match(styles, /low-density-result/)

  const draftIndex = detail.indexOf('下書き素材を作成する')
  const methodIndex = detail.indexOf('申請方法を見る')
  const expertsIndex = detail.indexOf('専門家候補を見る')
  assert.ok(draftIndex >= 0, 'detail page should lead with AI draft preparation')
  assert.ok(methodIndex > draftIndex, 'completed draft should lead to application method')
  assert.ok(expertsIndex > methodIndex, 'method page should lead to expert candidates')
  assert.match(detail, /資料入力は面談後で十分です/)
  assert.match(detail, /expert-details/)
  assert.match(detail, /根拠と必要書類を確認する/)
})

test('customer path backloads dense evidence behind progressive disclosure', async () => {
  const diagnose = await read('src/screens/diagnose.jsx')
  const detail = await read('src/screens/detail.jsx')

  assert.ok(
    diagnose.indexOf('候補{visibleMatches.length}件を見る') < diagnose.indexOf('result-list-card'),
    'subsidy rows should be behind an explicit candidate summary',
  )
  assert.ok(
    detail.indexOf('行政書士候補情報を詳しく見る') < detail.indexOf('experts.slice(0, 3).map'),
    'expert cards should be behind an explicit details summary',
  )
  assert.match(detail, /<details className="plan-meta">/)
  assert.match(detail, /<summary>根拠と必要書類を確認する<\/summary>/)
})

test('video-inspired consultation handoff has a complete next-step loop', async () => {
  const app = await read('src/App.jsx')
  const detail = await read('src/screens/detail.jsx')
  const home = await read('src/screens/home.jsx')
  const styles = await read('src/styles.css')

  for (const screen of ['ApplicationMethod', 'ExpertList', 'RequestConfirm', 'RequestComplete']) {
    assert.match(app, new RegExp(screen))
    assert.match(detail, new RegExp(`export function ${screen}`))
  }
  assert.match(detail, /下書きができました。/)
  assert.match(detail, /専門家の確認を入れる/)
  assert.match(detail, /AIのおすすめ/)
  assert.match(detail, /相談希望の記録は¥0/)
  assert.match(detail, /この内容で相談希望を出す/)
  assert.match(detail, /相談希望を記録しました/)
  assert.match(detail, /メッセージを見る/)
  assert.match(home, /相談希望を記録しました/)
  assert.match(home, /診断結果とAI下書きの確認をお願いします/)
  assert.match(home, /ChatBubble/)
  assert.match(home, /sendMessage/)
  assert.match(home, /consultationAutoReply/)
  assert.match(home, /onSubmit=/)
  assert.match(home, /value=\{messageText\}/)
  assert.match(home, /確認しました。担当者が面談時に内容を確認します。/)
  assert.match(styles, /method-cards-sales/)
  assert.match(styles, /sales-expert-card/)
  assert.match(styles, /consult-complete/)
  assert.match(styles, /chat-typing/)
})

test('AI draft generation shows progress and applicant confirmation before export', async () => {
  const detail = await read('src/screens/detail.jsx')
  const styles = await read('src/styles.css')

  assert.match(detail, /ProgressFlow/)
  assert.match(detail, /AIが下書きの参考素材を生成しています/)
  assert.match(detail, /className="gen-scaffold"/)
  assert.match(detail, /plan\.generation\.started/)
  assert.match(detail, /plan\.error/)
  assert.match(detail, /safeDraftGenerationMessage/)
  assert.match(detail, /本人確認用の下書きであることを確認しました/)
  assert.match(detail, /draftResponsibility/)
  assert.match(detail, /noDelegatedFiling/)
  assert.match(styles, /\.progress-flow/)
  assert.match(styles, /genShimmer/)
  assert.match(styles, /\.gen-scaffold/)
  assert.match(styles, /prefers-reduced-motion: reduce/)
  assert.match(styles, /\.export-confirmation/)
})
