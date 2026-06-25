import { useEffect, useState } from 'react'
import { NavBar, Spinner, ProgressBar, SubsidyRow, Card, Badge, Button, EmptyState, Input, AnimatedNumber } from '../ds.js'
import { api, openEvents } from '../api.js'
import { ParticleField, StreamingText } from '../motion/index.js'

const STEP_LABELS = [
  { id: 'scraping', label: 'サイトを読み込み' },
  { id: 'extracting', label: '事業内容を整理' },
  { id: 'matching', label: '補助金DBと照合' },
]
const MIN_DIAGNOSIS_MS = 1800

export function Diagnosing({ nav, app }) {
  const [progress, setProgress] = useState(8)
  const [step, setStep] = useState('scraping')
  const [message, setMessage] = useState('会社サイトを確認しています')
  const [error, setError] = useState('')
  const [converging, setConverging] = useState(false)

  useEffect(() => {
    if (!app.diagnosis?.id) return undefined
    let closed = false
    const startedAt = performance.now()
    const source = openEvents(`/v1/diagnoses/${app.diagnosis.id}/events`, {
      'diagnosis.progress': (data) => {
        setStep(data.step)
        setProgress(data.progress)
        setMessage(data.message)
      },
      'diagnosis.done': async () => {
        if (closed) return
        setConverging(true)
        await waitForMinimum(startedAt, MIN_DIAGNOSIS_MS)
        if (closed) return
        const matchesResult = await api(`/v1/diagnoses/${app.diagnosis.id}/matches`)
        const diagnosis = await api(`/v1/diagnoses/${app.diagnosis.id}`)
        nav.set({ matchesResult, diagnosis })
        source.close()
        nav.replace('results')
      },
      'diagnosis.error': (data) => {
        setError(data.message || '診断に失敗しました')
        source.close()
      },
      error: async (instance) => {
        try {
          const diagnosis = await api(`/v1/diagnoses/${app.diagnosis.id}`)
          if (diagnosis.status === 'done') {
            setConverging(true)
            await waitForMinimum(startedAt, MIN_DIAGNOSIS_MS)
            if (closed) return
            const matchesResult = await api(`/v1/diagnoses/${app.diagnosis.id}/matches`)
            nav.set({ matchesResult, diagnosis })
            instance.close()
            nav.replace('results')
          }
        } catch {
          setMessage('接続を確認しています...')
        }
      },
    })
    return () => {
      closed = true
      source.close()
    }
  }, [app.diagnosis?.id])

  return (
    <>
      <NavBar title="診断中" noBorder />
      <div className="screen diagnosing-screen">
        <div className="diag-wrap diag-wrap-hero">
          <ParticleField mode={converging ? 'converge' : 'diagnosing'} core anchorSelector=".scan-orbit" />
          <div className="scan-orbit">
            <Spinner />
            <span className="scan-ring" aria-hidden="true" />
            <span className="scan-beam" aria-hidden="true" />
          </div>
          <div className="home-kicker">公開情報を解析中</div>
          <div className="diag-h">補助金候補を絞り込んでいます</div>
          <div className="diag-url">{app.url.replace(/^https?:\/\//, '')}</div>
          <div className="diag-meter">
            <ProgressBar value={progress} />
            <span><AnimatedNumber value={progress} format="percent" duration={420} /></span>
          </div>
          <div className="diag-step-list">
            {STEP_LABELS.map((item) => {
              const state = stepState(item.id, step)
              return (
                <div key={item.id} className={`diag-step ${state}`}>
                  <span className="dot" />
                  <span>{item.label}</span>
                </div>
              )
            })}
          </div>
          <p className="lead diag-message">{message}</p>
          {error && (
            <>
              <div className="error-box">{error}</div>
              <Button variant="ghost" onClick={() => nav.home()}>戻る</Button>
            </>
          )}
        </div>
      </div>
    </>
  )
}

export function Results({ nav, app }) {
  const data = app.matchesResult
  const [loadingId, setLoadingId] = useState('')
  const [error, setError] = useState('')
  const [savingConfirmations, setSavingConfirmations] = useState(false)
  const [bloom, setBloom] = useState(0)

  useEffect(() => {
    const timer = setTimeout(() => setBloom(1), 60)
    return () => clearTimeout(timer)
  }, [])

  const openDetail = async (match) => {
    setLoadingId(match.roundId)
    setError('')
    try {
      const detail = await api(`/v1/subsidies/rounds/${match.roundId}`)
      nav.set({ selectedMatch: match, detail })
      nav.go('detail')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoadingId('')
    }
  }

  const saveApplicantConfirmations = async (answers) => {
    if (!app.diagnosis?.id) return
    setSavingConfirmations(true)
    setError('')
    try {
      const matchesResult = await api(`/v1/diagnoses/${app.diagnosis.id}/applicant-confirmations`, {
        method: 'POST',
        body: { answers },
      })
      const diagnosis = await api(`/v1/diagnoses/${app.diagnosis.id}`)
      nav.set({ matchesResult, diagnosis })
    } catch (err) {
      setError(err.message)
    } finally {
      setSavingConfirmations(false)
    }
  }

  if (!data) {
    return (
      <>
        <NavBar title="診断結果" left="診断" onLeft={() => nav.home()} />
        <div className="screen"><EmptyState title="診断結果がありません" hint="診断から候補を確認しましょう" /></div>
      </>
    )
  }

  const topMatch = data.matches?.[0]
  const visibleMatches = (data.matches || []).slice(0, 3)
  const hasMatches = visibleMatches.length > 0
  const visibleTotalLimit = visibleMatches.reduce((sum, match) => sum + Number(match.maxLimit || 0), 0)

  return (
    <>
      <NavBar title="診断結果" left="診断" onLeft={() => nav.home()} noBorder />
      <div className="screen fade">
        <div className="pad results-pad">
          <div className="result-hero low-density-result">
            <ParticleField mode="ambient" coreY={0.5} bloomKey={bloom} />
            <div className="home-kicker">診断が完了しました</div>
            <div className="result-money-label">おすすめ{visibleMatches.length}件の上限合計</div>
            <div className="result-money-hero">
              <AnimatedNumber value={visibleTotalLimit} format="yen" variant="slot" duration={1200} />
            </div>
            <div className="result-quick-stats">
              <span><AnimatedNumber value={visibleMatches.length} />件候補</span>
              {topMatch && <span>最短締切 {formatDays(topMatch.daysLeft)}</span>}
              {topMatch && <span>一致 {formatSoftScore(topMatch)}</span>}
            </div>
            <StreamingText
              tag="p"
              className="lead result-lead"
              startDelay={420}
              text={hasMatches
                ? `${data.company?.name || '会社サイト'}の公開情報から、まず専門家に確認すべき候補を絞りました。`
                : '公開情報だけでは補助金候補を安全に絞れませんでした。'}
            />
            {topMatch ? (
              <Button
                variant="primary"
                size="lg"
                onClick={() => openDetail(topMatch)}
                loading={loadingId === topMatch.roundId}
              >
                行政書士相談へ進む
              </Button>
            ) : (
              <Button variant="primary" size="lg" onClick={() => nav.home()}>
                会社情報を補足する
              </Button>
            )}
            <div className="solution-panel solution-path">
              <div className="solution-step">
                <span>1</span>
                <b>候補を確認</b>
              </div>
              <div className="solution-step">
                <span>2</span>
                <b>行政書士に相談</b>
              </div>
              <div className="solution-step">
                <span>3</span>
                <b>資料を整理</b>
              </div>
            </div>
          </div>

          {error && <div className="error-box">{error}</div>}
          {!hasMatches ? (
            <Card title="公開情報だけでは候補を絞れませんでした" subtitle="事業内容や投資予定を補足すると候補を再判定できます。" />
          ) : (
            <details className="customer-details candidate-details">
              <summary>候補{visibleMatches.length}件を見る</summary>
              <div className="result-list-card">
                {visibleMatches.map((match) => (
                  <div key={match.id} className={loadingId === match.roundId ? 'loading-row' : ''}>
                    <SubsidyRow
                      name={match.programName}
                      frame={match.roundLabel}
                      meta={[
                        { label: '上限', value: formatYen(match.maxLimit) },
                        { label: '補助率', value: match.subsidyRate },
                        { label: '残', value: formatDays(match.daysLeft) },
                      ]}
                      onClick={() => openDetail(match)}
                    />
                    <div className="result-meta-row">
                      <Badge tone={hardRuleTone(match.hardRuleStatus)}>{hardRuleLabel(match.hardRuleStatus)}</Badge>
                      <Badge tone="brand-tint">一致 {formatSoftScore(match)}</Badge>
                    </div>
                    <div className="reason-line"><StreamingText text={match.reasons?.[0]?.description || ''} cps={60} /></div>
                  </div>
                ))}
              </div>
            </details>
          )}

          <details className="customer-details">
            <summary>読み取った会社情報と条件を確認する</summary>
            <Card title={data.company?.name || '会社情報'} style={{ margin: '14px 0' }}>
              <p className="compact-text">{data.company?.businessSummary}</p>
              <div className="chip-row">
                {(data.company?.keywords || []).slice(0, 4).map((keyword) => <Badge key={keyword} tone="neutral">{keyword}</Badge>)}
              </div>
              {data.company?.unknowns?.length > 0 && (
                <p className="warning-text">要確認: {data.company.unknowns.join('、')}</p>
              )}
            </Card>
            <ApplicantConfirmationForm
              company={data.company}
              confirmations={data.applicantConfirmations}
              hardRuleCounts={data.summary.hardRuleCounts}
              loading={savingConfirmations}
              onSave={saveApplicantConfirmations}
            />
          </details>
        </div>
      </div>
    </>
  )
}

function ApplicantConfirmationForm({ company, confirmations, hardRuleCounts, loading, onSave }) {
  const initialAnswers = confirmations?.answers || {}
  const [answers, setAnswers] = useState(() => ({
    prefecture: initialAnswers.prefecture === 'unknown' ? company?.prefecture || '' : initialAnswers.prefecture || company?.prefecture || '',
    city: initialAnswers.city === 'unknown' ? company?.city || '' : initialAnswers.city || company?.city || '',
    employeeCount: initialAnswers.employeeCount ?? '',
    capitalYen: initialAnswers.capitalYen ?? '',
    businessType: initialAnswers.businessType || 'unknown',
    plannedInvestmentYen: initialAnswers.plannedInvestmentYen ?? '',
    estimateStatus: initialAnswers.estimateStatus || 'unknown',
    gBizIDReadiness: initialAnswers.gBizIDReadiness || 'unknown',
    targetTiming: initialAnswers.targetTiming || 'unknown',
  }))

  const update = (field, value) => {
    setAnswers((state) => ({ ...state, [field]: value }))
  }

  return (
    <Card title="申請者確認" style={{ margin: '14px 0' }}>
      <div className="status-strip">
        <span>条件OK {hardRuleCounts?.eligible || 0}</span>
        <span>要確認 {hardRuleCounts?.needs_confirmation || 0}</span>
        <span>不一致 {hardRuleCounts?.mismatch || 0}</span>
      </div>
      {confirmations?.warnings?.length > 0 && (
        <div className="error-box">{confirmations.warnings[0]}</div>
      )}
      <div className="question-grid">
        <Input
          label="都道府県"
          name="prefecture"
          value={answers.prefecture}
          placeholder="東京都"
          onChange={(event) => update('prefecture', event.target.value)}
        />
        <Input
          label="市区町村"
          name="city"
          value={answers.city}
          placeholder="渋谷区"
          onChange={(event) => update('city', event.target.value)}
        />
        <Input
          label="従業員数"
          name="employeeCount"
          type="number"
          value={answers.employeeCount}
          placeholder="12"
          onChange={(event) => update('employeeCount', event.target.value)}
        />
        <Input
          label="資本金（円）"
          name="capitalYen"
          type="number"
          value={answers.capitalYen}
          placeholder="3000000"
          onChange={(event) => update('capitalYen', event.target.value)}
        />
        <SelectField
          label="事業者区分"
          name="businessType"
          value={answers.businessType}
          onChange={(value) => update('businessType', value)}
          options={[
            ['unknown', '未確認'],
            ['sole_proprietor', '個人事業主'],
            ['small_business', '小規模事業者'],
            ['sme', '中小企業'],
            ['nonprofit', 'NPO等'],
            ['large_company', '大企業'],
          ]}
        />
        <Input
          label="投資予定額（円）"
          name="plannedInvestmentYen"
          type="number"
          value={answers.plannedInvestmentYen}
          placeholder="1200000"
          onChange={(event) => update('plannedInvestmentYen', event.target.value)}
        />
        <SelectField
          label="見積状況"
          name="estimateStatus"
          value={answers.estimateStatus}
          onChange={(value) => update('estimateStatus', value)}
          options={[
            ['unknown', '未確認'],
            ['obtained', '取得済み'],
            ['requested', '依頼中'],
            ['not_started', '未着手'],
            ['not_required', '不要と認識'],
          ]}
        />
        <SelectField
          label="GビズID"
          name="gBizIDReadiness"
          value={answers.gBizIDReadiness}
          onChange={(value) => update('gBizIDReadiness', value)}
          options={[
            ['unknown', '未確認'],
            ['ready', '取得済み'],
            ['applying', '申請中'],
            ['not_started', '未着手'],
          ]}
        />
        <SelectField
          label="申請希望時期"
          name="targetTiming"
          value={answers.targetTiming}
          onChange={(value) => update('targetTiming', value)}
          options={[
            ['unknown', '未確認'],
            ['within_30_days', '30日以内'],
            ['within_3_months', '3か月以内'],
            ['after_3_months', '3か月より後'],
            ['undecided', '未定'],
          ]}
        />
      </div>
      <div style={{ marginTop: 14 }}>
        <Button variant="secondary" size="sm" onClick={() => onSave(answers)} loading={loading}>
          確認情報を保存して再判定
        </Button>
      </div>
    </Card>
  )
}

function SelectField({ label, name, value, onChange, options }) {
  return (
    <label className="select-field">
      <span>{label}</span>
      <select name={name} value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>{optionLabel}</option>
        ))}
      </select>
    </label>
  )
}

function formatYen(value) {
  return `¥${Number(value || 0).toLocaleString('en-US')}`
}

function formatDays(value) {
  if (value === null || value === undefined || value === '') return '未定'
  const days = Number(value)
  return Number.isFinite(days) ? `${days}日` : '未定'
}

function formatSoftScore(match) {
  const score = match?.softFit?.score ?? match?.scoreBreakdown?.total10
  if (Number.isFinite(Number(score))) return `${Number(score).toFixed(1).replace(/\.0$/, '')}/10`
  return '要確認'
}

function hardRuleLabel(status) {
  return {
    eligible: '硬条件OK',
    needs_confirmation: '硬条件要確認',
    mismatch: '硬条件不一致',
  }[status] || '硬条件要確認'
}

function hardRuleTone(status) {
  return {
    eligible: 'success',
    needs_confirmation: 'warning',
    mismatch: 'danger',
  }[status] || 'warning'
}

function stepState(id, current) {
  const order = ['scraping', 'extracting', 'matching']
  const currentIndex = order.indexOf(current)
  const index = order.indexOf(id)
  if (index < currentIndex) return 'done'
  if (index === currentIndex) return 'on'
  return ''
}

function waitForMinimum(startedAt, minMs) {
  const elapsed = performance.now() - startedAt
  const remaining = Math.max(0, minMs - elapsed)
  return new Promise((resolve) => setTimeout(resolve, remaining))
}
