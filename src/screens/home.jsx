import { useEffect, useRef, useState } from 'react'
import { NavBar, Input, Button, Card, EmptyState, Badge, Checkbox, AnimatedNumber, Switch, ChatBubble } from '../ds.js'
import { api } from '../api.js'
import { ParticleField } from '../motion/index.js'

export function Home({ nav, app }) {
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [attested, setAttested] = useState(true)

  const startDiagnosis = async () => {
    setError('')
    setLoading(true)
    try {
      const response = await api('/v1/diagnoses', {
        method: 'POST',
        body: { url: app.url, attested },
      })
      nav.set({
        diagnosis: { id: response.diagnosisId, companyId: response.companyId, status: response.status },
        matchesResult: null,
        selectedMatch: null,
        detail: null,
        plan: null,
      })
      nav.go('diagnosing')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const latestDiagnosis = app.diagnosis

  return (
    <>
      <NavBar brand noBorder />
      <div className="screen fade">
        <div className="pad home-pad">
          <div className="home-hero">
            <ParticleField mode="ambient" coreY={0.3} />
            <div className="home-kicker">公開サイト診断</div>
            <h1 className="client-title">会社サイトから、使える補助金を確認します。</h1>
            <p className="lead home-lead">
              入力された公開ページを読み取り、補助金候補、上限額、次に相談すべき専門家ルートまで一気に整理します。
            </p>
          </div>

          <div className="url-panel">
            <Input
              label="会社のURL"
              name="companyUrl"
              placeholder="https://会社のURL"
              value={app.url}
              error={error}
              disabled={loading}
              onChange={(event) => nav.set({ url: event.target.value })}
            />
            <Checkbox
              label="自社サイトの公開ページとして確認します"
              checked={attested}
              onChange={setAttested}
            />
            <Button variant="primary" size="lg" onClick={startDiagnosis} loading={loading} disabled={!attested}>
              診断を始める
            </Button>
          </div>

          <div className="trust-row">
            <span>公開ページのみ</span>
            <span>ログイン不要</span>
            <span>出典つき候補</span>
          </div>

          {latestDiagnosis?.status === 'done' && app.matchesResult ? (
            <Card
              variant="highlight"
              tappable
              onClick={() => nav.go('results')}
              title={app.matchesResult.company?.name || '診断結果'}
              subtitle={
                <>
                  <AnimatedNumber value={app.matchesResult.summary.matchCount} variant="slot" />件マッチ ・ 上限合計{' '}
                  <AnimatedNumber value={app.matchesResult.summary.totalLimit} format="yen" variant="slot" /> ・ たった今
                </>
              }
              style={{ marginTop: 24 }}
            />
          ) : (
            <div className="home-proof">
              <Badge tone="brand-tint">例: www.sample-corp.example</Badge>
              <p>明日のデモでは、このURLをそのまま入力して診断できます。</p>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

export function ApplyRoot({ nav, app }) {
  const plans = app.plan ? [app.plan] : []
  return (
    <>
      <NavBar title="申請準備" />
      <div className="screen fade">
        <div className="pad">
          {plans.length === 0 ? (
            <EmptyState title="まだ準備中の補助金はありません" hint="診断から候補を確認しましょう" />
          ) : (
            <>
              {plans.map((plan) => (
                <Card
                  key={plan.id}
                  variant="highlight"
                  tappable
                  onClick={() => nav.go('plan')}
                  title={app.detail?.program?.name || '事業計画書'}
                  subtitle={`${statusLabel(plan.status)} ・ 必要書類の確認が必要です`}
                  style={{ marginBottom: 12 }}
                />
              ))}
              <p className="lead" style={{ marginTop: 16 }}>
                AI下書きです。提出前に必ず本人確認が必要です。
              </p>
              {app.exports.length > 0 && (
                <>
                  <div className="section-h" style={{ margin: '24px 0 10px' }}>出力済みファイル</div>
                  {app.exports.map((file) => (
                    <div className="mini-row" key={`${file.format}-${file.createdAt}`}>
                      <span>{file.format.toUpperCase()}</span>
                      <span className="v">免責文あり</span>
                    </div>
                  ))}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </>
  )
}

export function MsgRoot({ nav, app }) {
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(app.waitlisted)
  const [messageText, setMessageText] = useState('')
  const [replying, setReplying] = useState(false)
  const [messages, setMessages] = useState([])
  const replyTimerRef = useRef(null)
  const chatEndRef = useRef(null)
  const experts = app.expertRecommendations || []
  const selectedExpert = app.selectedExpert || experts[0]

  const submit = async (expertId = null) => {
    setLoading(true)
    try {
      await api('/v1/leads/expert', {
        method: 'POST',
        body: {
          diagnosisId: app.diagnosis?.id,
          roundId: app.selectedMatch?.roundId,
          expertId,
          message: expertId ? 'この専門家候補への相談を希望します' : '専門家相談が始まったら知らせてください',
        },
      })
      setSent(true)
      nav.set({ waitlisted: true })
      await nav.refreshMe()
    } finally {
      setLoading(false)
    }
  }

  const sendMessage = () => {
    const text = messageText.trim()
    if (!text || replying) return

    const sentAt = Date.now()
    setMessages((current) => [
      ...current,
      { id: `user-${sentAt}`, from: 'me', text },
    ])
    setMessageText('')
    setReplying(true)

    window.clearTimeout(replyTimerRef.current)
    replyTimerRef.current = window.setTimeout(() => {
      setMessages((current) => [
        ...current,
        {
          id: `expert-${sentAt}`,
          from: 'them',
          text: consultationAutoReply(text),
        },
      ])
      setReplying(false)
    }, 700)
  }

  useEffect(() => () => window.clearTimeout(replyTimerRef.current), [])

  useEffect(() => {
    if (!sent) return
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages.length, replying, sent])

  return (
    <>
      <NavBar title={selectedExpert?.name || 'メッセージ'} />
      <div className="chat-screen fade">
        {sent ? (
          <>
            <div className="chat-body">
              {initialConsultationMessages().map((message) => (
                <ChatBubble key={message.id} from={message.from} variant={message.variant}>
                  {message.text}
                </ChatBubble>
              ))}
              <Card style={{ margin: '18px 0 12px' }}>
                <div className="section-h">共有済み</div>
                <div className="msg-share-title">{app.detail?.program?.name || '補助金候補'}</div>
                <p className="compact-text">事業計画書（AI下書き）・診断結果・要確認項目</p>
              </Card>
              {messages.map((message) => (
                <ChatBubble key={message.id} from={message.from}>
                  {message.text}
                </ChatBubble>
              ))}
              {replying && (
                <div className="chat-typing" aria-live="polite">
                  確認しています
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
            <form
              className="chat-input"
              onSubmit={(event) => {
                event.preventDefault()
                sendMessage()
              }}
            >
              <input
                aria-label="メッセージ"
                placeholder="メッセージを入力"
                value={messageText}
                onChange={(event) => setMessageText(event.target.value)}
                disabled={replying}
              />
              <button className="send" type="submit" disabled={!messageText.trim() || replying}>
                送信
              </button>
            </form>
          </>
        ) : (
          <div className="pad">
            <EmptyState
              title="まだ相談希望はありません"
              hint="診断結果から下書きを作成し、専門家候補へ相談希望を出せます。"
            />
            {experts.length > 0 && (
              <>
                <div className="section-h" style={{ margin: '22px 0 10px' }}>行政書士候補情報</div>
                {experts.slice(0, 3).map((expert) => (
                  <Card key={expert.id} style={{ marginBottom: 12 }}>
                    <div className="section-title-row">
                      <div>
                        <div className="bp-h">{expert.name}</div>
                        <p className="compact-text">{expert.serviceArea} ・ 公開情報との一致 {expert.score}/10</p>
                      </div>
                      <Badge tone={expert.fitLevel === 'strong' ? 'success' : 'brand-tint'}>
                        {expert.fitLevel === 'strong' ? '高一致' : '候補'}
                      </Badge>
                    </div>
                    <p className="compact-text">{expert.reasons?.[0]}</p>
                    {expert.caveats?.[0] && <p className="warning-text">{expert.caveats[0]}</p>}
                    <div style={{ marginTop: 12 }}>
                      <Button variant="ghost" onClick={() => submit(expert.id)} loading={loading}>
                        この候補情報で相談希望を出す
                      </Button>
                    </div>
                  </Card>
                ))}
              </>
            )}
            {experts.length === 0 && (
              <div style={{ marginTop: 18 }}>
                <Button variant="primary" onClick={() => nav.home()}>診断から始める</Button>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}

function initialConsultationMessages() {
  return [
    { id: 'day', variant: 'system', text: '今日' },
    { id: 'lead-recorded', variant: 'system', text: '相談希望を記録しました' },
    { id: 'initial-share', from: 'me', text: '診断結果とAI下書きの確認をお願いします。' },
    {
      id: 'initial-reply',
      from: 'them',
      text: '内容を確認できる状態です。面談後に、必要書類と提出前の確認事項を整理します。',
    },
  ]
}

function consultationAutoReply(text) {
  if (/日程|時間|いつ|面談/.test(text)) {
    return 'ありがとうございます。面談時に確認できるよう、担当者に共有しました。'
  }
  if (/書類|資料|決算|見積/.test(text)) {
    return '承知しました。必要書類は面談後に整理しますので、現時点では分かる範囲で問題ありません。'
  }
  return '確認しました。担当者が面談時に内容を確認します。'
}

export function MyPage({ nav, app }) {
  const [settings, setSettings] = useState(app.notificationSettings || { push: true, email: true, deadline: true })
  const [saving, setSaving] = useState(false)
  const [llmUsage, setLlmUsage] = useState(null)
  const company = app.matchesResult?.company
  const canViewLlmUsage = ['owner', 'admin', 'system_admin'].includes(app.user?.role)

  const saveSettings = async (next) => {
    setSettings(next)
    setSaving(true)
    try {
      await api('/v1/me/notifications/settings', { method: 'PUT', body: next })
      nav.set({ notificationSettings: next })
      await nav.refreshMe()
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    if (!canViewLlmUsage) return undefined
    api('/v1/admin/llm-usage?limit=5')
      .then((summary) => {
        if (!cancelled) setLlmUsage(summary)
      })
      .catch(() => {
        if (!cancelled) setLlmUsage(null)
      })
    return () => {
      cancelled = true
    }
  }, [canViewLlmUsage])

  return (
    <>
      <NavBar title="マイページ" />
      <div className="screen fade">
        <div className="pad">
          <div className="mp-head">
            <div className="mp-avatar">補</div>
            <div>
              <div className="mp-name">{company?.name || '開発用ユーザー'}</div>
              <div className="mp-mail">{app.user?.email}</div>
            </div>
          </div>
          <div className="mp-row"><span>会社URL</span><span className="v">{app.url.replace(/^https?:\/\//, '')}</span></div>
          <div className="mp-row"><span>所在地</span><span className="v">{company?.prefecture || '要確認'}</span></div>
          <div className="mp-row"><span>確認した候補</span><span className="v">{app.matchesResult ? `${app.matchesResult.summary.matchCount}件` : '0件'}</span></div>
          <div className="section-h" style={{ margin: '24px 0 10px' }}>通知設定</div>
          <Switch name="push" label="Push" checked={settings.push} onChange={(value) => saveSettings({ ...settings, push: value })} />
          <Switch name="email" label="Email" checked={settings.email} onChange={(value) => saveSettings({ ...settings, email: value })} />
          <Switch name="deadline" label="締切リマインド" checked={settings.deadline} onChange={(value) => saveSettings({ ...settings, deadline: value })} />
          {saving && <p className="lead">保存しています</p>}
          {canViewLlmUsage && llmUsage && (
            <>
              <div className="section-h" style={{ margin: '24px 0 10px' }}>LLM利用・概算費用</div>
              <div className="mp-row"><span>今月</span><span className="v">{formatUsd(llmUsage.totals.monthActualCostUsd)}</span></div>
              <div className="mp-row"><span>今日</span><span className="v">{formatUsd(llmUsage.totals.todayActualCostUsd)}</span></div>
              <div className="mp-row"><span>実行回数</span><span className="v">{llmUsage.totals.runCount}回</span></div>
              <div className="mp-row"><span>入力/出力token</span><span className="v">{llmUsage.totals.actualInputTokens}/{llmUsage.totals.actualOutputTokens}</span></div>
              {llmUsage.recentRuns?.length > 0 && (
                <div className="compact-ledger">
                  {llmUsage.recentRuns.map((run) => (
                    <div className="mini-row" key={run.id}>
                      <span>{run.status}</span>
                      <span className="v">{run.inputTokens}/{run.outputTokens} tok ・ {formatUsd(run.actualCostUsd)}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
          <div style={{ marginTop: 20 }}>
            <Button variant="ghost" onClick={() => nav.tab('diag')}>会社情報を補足して再診断</Button>
          </div>
        </div>
      </div>
    </>
  )
}

function formatUsd(value) {
  return `$${Number(value || 0).toFixed(4)}`
}

function statusLabel(status) {
  return {
    generating: '作成中',
    draft: '下書き保存済み',
    edited: '編集済み',
    exported: '出力済み',
  }[status] || '下書き'
}

function formatYen(value) {
  return `¥${Number(value || 0).toLocaleString('en-US')}`
}
