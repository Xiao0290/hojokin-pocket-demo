import { useEffect, useState } from 'react'
import { NavBar, Checkbox, Button, Card, Badge, EmptyState, AnimatedNumber } from '../ds.js'
import { api, apiBaseUrl, openEvents } from '../api.js'
import { ProgressFlow } from '../motion/index.js'

const SAFE_DRAFT_GENERATION_ERROR = '下書きの作成を完了できませんでした。時間をおいて、もう一度お試しください。'

// 生成中スキャフォールド用の章立て（サーバーの章見出しと一致。section.started で確定）。
const GEN_CHAPTERS = [
  { no: 1, heading: '事業概要' },
  { no: 2, heading: '課題と投資の必要性' },
  { no: 3, heading: '実施内容' },
  { no: 4, heading: '効果見込み' },
  { no: 5, heading: '確認事項・必要書類' },
]

export function SubsidyDetail({ nav, app }) {
  const detail = app.detail
  const match = app.selectedMatch
  const [checked, setChecked] = useState({})
  const [loading, setLoading] = useState(false)
  const [waitlistLoading, setWaitlistLoading] = useState(false)
  const [waitlisted, setWaitlisted] = useState(app.waitlisted)
  const [experts, setExperts] = useState(app.expertRecommendations || [])
  const [expertError, setExpertError] = useState('')
  const doneCount = Object.values(checked).filter(Boolean).length

  useEffect(() => {
    if (!detail?.roundId) return undefined
    let cancelled = false
    api(`/v1/experts/recommendations?roundId=${encodeURIComponent(detail.roundId)}&diagnosisId=${encodeURIComponent(app.diagnosis?.id || '')}`)
      .then((result) => {
        if (cancelled) return
        setExperts(result.recommendations || [])
        nav.set({ expertRecommendations: result.recommendations || [] })
      })
      .catch((error) => {
        if (!cancelled) setExpertError(error.message)
      })
    return () => {
      cancelled = true
    }
  }, [detail?.roundId, app.diagnosis?.id])

  if (!detail || !match) {
    return (
      <>
        <NavBar title="補助金詳細" left="結果" onLeft={() => nav.back()} />
        <div className="screen"><EmptyState title="詳細がありません" hint="診断結果から候補を選んでください" /></div>
      </>
    )
  }

  const matchScoreLabel = formatMatchScore(match)
  const hardChecks = match.hardRule?.checks || []

  const createPlan = async () => {
    setLoading(true)
    try {
      const response = await api('/v1/business-plans', {
        method: 'POST',
        body: {
          companyId: app.diagnosis?.company?.id || app.diagnosis?.companyId || app.matchesResult?.company?.id,
          roundId: detail.roundId,
          targetChars: 4200,
        },
      })
      nav.set({ plan: { id: response.planId, status: response.status, sections: [] } })
      nav.go('plan')
    } finally {
      setLoading(false)
    }
  }

  const submitWaitlist = async (expertId = null) => {
    setWaitlistLoading(true)
    try {
      await api('/v1/leads/expert', {
        method: 'POST',
        body: {
          diagnosisId: app.diagnosis?.id,
          roundId: detail.roundId,
          expertId,
          message: expertId
            ? 'この専門家候補への相談を希望します'
            : '専門家相談が始まったら知らせてください',
        },
      })
      setWaitlisted(true)
      nav.set({ waitlisted: true })
      await nav.refreshMe()
    } finally {
      setWaitlistLoading(false)
    }
  }

  return (
    <>
      <NavBar title="補助金詳細" left="結果" onLeft={() => nav.back()} noBorder />
      <div className="screen fade">
        <div className="pad detail-pad">
          <div className="detail-hero">
            <div className="home-kicker">おすすめ候補</div>
            <h1 className="detail-title">{detail.program.name}</h1>
            <div className="detail-limit">
              <AnimatedNumber value={detail.maxLimit} format="yen" variant="slot" duration={1100} />
            </div>
            <div className="detail-stats">
              <div>
                <span>補助率</span>
                <b title={detail.subsidyRate}>{formatSubsidyRateShort(detail.subsidyRate)}</b>
              </div>
              <div>
                <span>残日数</span>
                <b>{formatDays(detail.daysLeft)}</b>
              </div>
              <div>
                <span>一致度</span>
                <b>{matchScoreLabel}</b>
              </div>
            </div>
          </div>

          <div className="expert-handoff">
            <div>
              <div className="handoff-label">次にやること</div>
              <h2>下書き素材を作成する</h2>
              <p>公開情報と制度要件から、専門家に見せる確認用の下書きを先に作ります。資料入力は面談後で十分です。</p>
            </div>
            <Button variant="primary" onClick={createPlan} loading={loading}>
              下書きを作成する
            </Button>
          </div>

          <div className="reason-strip">
            <div className="section-h">おすすめ理由</div>
            <p>{match.reasons?.[0]?.description}</p>
            <div className="chip-row">
              <Badge tone={hardRuleTone(match.hardRuleStatus)}>硬条件 {hardRuleLabel(match.hardRuleStatus)}</Badge>
              <Badge tone="brand-tint">公開情報との一致度 {matchScoreLabel}</Badge>
            </div>
            <p className="warning-text">申請可否や採択可能性の判定ではありません。公式サイトと本人確認情報で確認してください。</p>
          </div>

          <details className="customer-details expert-details">
            <summary>行政書士候補情報を詳しく見る</summary>
            {expertError && <div className="error-box">{expertError}</div>}
            {experts.length === 0 ? (
              <Card title="候補を確認しています" subtitle="制度と会社情報に合う行政書士候補を取得します" />
            ) : (
              experts.slice(0, 3).map((expert) => (
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
                  <div className="chip-row">
                    {(expert.matchedKeywords || []).slice(0, 3).map((keyword) => (
                      <Badge key={`${expert.id}-${keyword}`} tone="neutral">{keyword}</Badge>
                    ))}
                  </div>
                  <div style={{ marginTop: 12 }}>
                    <Button variant="ghost" size="sm" onClick={() => submitWaitlist(expert.id)} loading={waitlistLoading} disabled={waitlisted}>
                      {waitlisted ? '相談希望を受付済み' : 'この候補情報で相談希望を出す'}
                    </Button>
                  </div>
                </Card>
              ))
            )}
          </details>

          <details className="customer-details detail-checks">
            <summary>要件・必要書類を確認する</summary>
            <div className="section-h" style={{ margin: '18px 0 8px' }}>申請者確認と硬条件</div>
            <Card>
              <div className="chip-row" style={{ marginTop: 0 }}>
                <Badge tone={hardRuleTone(match.hardRuleStatus)}>{hardRuleLabel(match.hardRuleStatus)}</Badge>
                <Badge tone="neutral">{match.hardRule?.source === 'applicant_confirmation' ? '申請者回答あり' : '公開情報のみ'}</Badge>
              </div>
              {match.hardRule?.warnings?.[0] ? (
                <p className="warning-text">{match.hardRule.warnings[0]}</p>
              ) : (
                <p className="compact-text" style={{ marginTop: 10 }}>入力済みの硬条件では大きな矛盾はありません。</p>
              )}
              {hardChecks.length > 0 && (
                <div className="hard-check-list">
                  {hardChecks.slice(0, 5).map((check, index) => (
                    <div className="hard-check-row" key={`${check.field}-${index}`}>
                      <span>{check.label}</span>
                      <Badge tone={hardRuleTone(check.status)}>{hardRuleLabel(check.status)}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <div className="section-h" style={{ margin: '22px 0 8px' }}>要件</div>
            {detail.requirements.map((req, index) => (
              <div className="mini-row" key={`${req.label}-${index}`}>
                <span>{req.label}</span>
                <span className="v">{resultLabel(req.result)}</span>
              </div>
            ))}

            <div className="steps-head">
              <span className="section-h">必要書類</span>
              <span className="r">{doneCount} / {detail.requiredDocuments.length} 完了</span>
            </div>
            {detail.requiredDocuments.map((doc, index) => (
              <Checkbox
                key={`${doc.label}-${index}`}
                label={doc.label}
                aiTag={doc.aiDraftable}
                checked={!!checked[doc.label]}
                onChange={(value) => setChecked((state) => ({ ...state, [doc.label]: value }))}
              />
            ))}

            <div className="section-h" style={{ margin: '22px 0 8px' }}>出典</div>
            {detail.sourceRefresh?.warning && (
              <Card title="出典の再確認が必要です" subtitle={detail.sourceRefresh.warning} />
            )}
            <Card title={`最終確認: ${formatDate(detail.lastSeenAt)}`} subtitle={detail.program.sourceUrl} />

            <div className="section-h" style={{ margin: '22px 0 8px' }}>相談後の準備</div>
            <Card title="下書き作成" subtitle="行政書士との確認後に、必要な範囲だけ作成・編集します。">
              <div style={{ marginTop: 14 }}>
                <Button variant="ghost" onClick={createPlan} loading={loading}>
                  下書きを作成する
                </Button>
              </div>
            </Card>
          </details>
        </div>
      </div>
      <div className="footer">
        <Button variant="primary" onClick={createPlan} loading={loading}>
          下書きを作成する
        </Button>
      </div>
    </>
  )
}

export function BusinessPlan({ nav, app }) {
  const [plan, setPlan] = useState(app.plan)
  const [active, setActive] = useState(1)
  const [progress, setProgress] = useState(8)
  const [doneChapters, setDoneChapters] = useState([])
  const [streamText, setStreamText] = useState('')
  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState('')
  const [error, setError] = useState('')
  const [draftConfirmed, setDraftConfirmed] = useState(Boolean(app.plan?.applicantDraftConfirmation))
  const ready = plan && ['draft', 'edited', 'exported'].includes(plan.status)
  const failed = plan?.status === 'failed'

  useEffect(() => {
    if (!app.plan?.id) return undefined
    let closed = false
    const source = openEvents(`/v1/business-plans/${app.plan.id}/events`, {
      'plan.generation.started': () => {
        setProgress((value) => Math.max(value, 18))
      },
      'plan.section.started': (data) => {
        setActive(data.chapterNo)
        setProgress((value) => Math.max(value, Math.min(88, 22 + Number(data.chapterNo || 1) * 11)))
      },
      'plan.section.delta': (data) => {
        setStreamText((text) => `${text}${text ? '\n\n' : ''}${data.delta}`)
      },
      'plan.section.completed': (data) => {
        setProgress((value) => Math.max(value, Math.min(94, 28 + Number(data.chapterNo || 1) * 12)))
        setDoneChapters((list) => (list.includes(data.chapterNo) ? list : [...list, data.chapterNo]))
      },
      'plan.completed': async () => {
        if (closed) return
        const latest = await api(`/v1/business-plans/${app.plan.id}`)
        setPlan(latest)
        setError('')
        setProgress(100)
        setDraftConfirmed(Boolean(latest.applicantDraftConfirmation))
        nav.set({ plan: latest })
        source.close()
      },
      'plan.error': (data) => {
        setError(safeDraftGenerationMessage(data))
        setProgress(100)
        source.close()
      },
      error: async (instance) => {
        try {
          const latest = await api(`/v1/business-plans/${app.plan.id}`)
          if (['draft', 'edited', 'exported'].includes(latest.status)) {
            setPlan(latest)
            setError('')
            setProgress(100)
            setDraftConfirmed(Boolean(latest.applicantDraftConfirmation))
            nav.set({ plan: latest })
            instance.close()
          } else if (latest.status === 'failed') {
            setPlan(latest)
            setError(safeDraftGenerationMessage(latest.error))
            setProgress(100)
            instance.close()
          } else if (!ready) {
            setError('接続を確認しています...')
          }
        } catch {
          if (!ready) setError('接続を確認しています...')
        }
      },
    })
    return () => {
      closed = true
      source.close()
    }
  }, [app.plan?.id])

  useEffect(() => {
    if (ready) setProgress(100)
  }, [ready])

  const updateSection = (chapterNo, body) => {
    const next = {
      ...plan,
      sections: plan.sections.map((section) => (
        section.chapterNo === chapterNo ? { ...section, body, status: 'edited' } : section
      )),
    }
    setPlan(next)
  }

  const saveSection = async (section) => {
    setSaving(true)
    setError('')
    try {
      const result = await api(`/v1/business-plans/${plan.id}/sections/${section.chapterNo}`, {
        method: 'PATCH',
        body: { body: section.body, status: section.status || 'edited' },
      })
      const latest = await api(`/v1/business-plans/${plan.id}`)
      setPlan(latest)
      nav.set({ plan: latest })
      setActive(result.chapterNo)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const exportFile = async (format) => {
    if (!draftConfirmed) {
      setError('出力前に、下書きが本人確認用であることを確認してください。')
      return
    }
    setExporting(format)
    setError('')
    try {
      await api(`/v1/business-plans/${plan.id}/confirmation`, {
        method: 'POST',
        body: {
          draftResponsibility: true,
          sourceReview: true,
          noDelegatedFiling: true,
        },
      })
      const file = await api(`/v1/business-plans/${plan.id}/export`, {
        method: 'POST',
        body: { format },
      })
      const latest = await api(`/v1/business-plans/${plan.id}`)
      setPlan(latest)
      setDraftConfirmed(Boolean(latest.applicantDraftConfirmation))
      nav.set({ plan: latest, exports: latest.exports || [] })
      await nav.refreshMe()
      window.open(`${apiBaseUrl}${file.fileUrl}`, '_blank')
    } catch (err) {
      setError(err.message)
    } finally {
      setExporting('')
    }
  }

  return (
    <>
      <NavBar title="事業計画書" left="戻る" onLeft={() => nav.back()} />
      <div className="screen">
        <div className="pad">
          <p className="lead" style={{ marginTop: 0 }}>
            申請者ご本人の確認用下書きです。提出前に必ず本人確認が必要です。
          </p>
          {error && <div className="error-box">{error}</div>}
          {!ready ? (
            failed ? (
              <Card>
                <div className="bp-status">
                  <span className="l"><span className="dot" />下書きの作成を完了できませんでした</span>
                  <span className="c">再試行できます</span>
                </div>
                <p className="lead">
                  公開情報と制度要件は保持されています。補助金詳細に戻って、もう一度下書き素材を作成してください。
                </p>
                <Button variant="primary" onClick={() => nav.back()}>戻ってもう一度試す</Button>
              </Card>
            ) : (
            <div className="bp-generating">
              <div className="bp-status">
                <span className="l">
                  <span className="dot live" />
                  AIが下書きの参考素材を生成しています
                </span>
                <span className="c">第{active}章 ・ <AnimatedNumber value={progress} format="percent" duration={420} /></span>
              </div>
              <ProgressFlow value={progress} active aria-label="下書き生成の進捗" />
              <ol className="gen-scaffold" aria-hidden="true">
                {GEN_CHAPTERS.map((chapter) => {
                  const done = doneChapters.includes(chapter.no)
                  const on = !done && chapter.no === active
                  return (
                    <li key={chapter.no} className={`gen-step${done ? ' dn' : on ? ' on' : ''}`}>
                      <span className="nd" />第{chapter.no}章　{chapter.heading}
                    </li>
                  )
                })}
              </ol>
              <div className="gen-body">
                {streamText
                  ? <div className="bp-b">{streamText}<span className="caret" /></div>
                  : (
                    <div className="gen-skeleton" aria-hidden="true">
                      <span /><span /><span />
                    </div>
                  )}
              </div>
            </div>
            )
          ) : (
            <>
              <div className="bp-status">
                <span className="l"><span className="dot" />下書きが作成されました</span>
                <span className="c">{plan.template?.name || `${plan.sections.length}章`}</span>
              </div>
              {plan.sections.map((section) => (
                <Card key={section.chapterNo} style={{ marginBottom: 14 }}>
                  <div className="section-title-row">
                    <div className="bp-h">{section.chapterNo}. {section.heading}</div>
                    <Badge tone={section.status === 'edited' ? 'success' : section.status === 'needs_confirmation' ? 'warning' : 'brand-tint'}>
                      {section.status === 'edited' ? '編集済み' : section.status === 'needs_confirmation' ? '要確認' : 'AI下書き'}
                    </Badge>
                  </div>
                  <textarea
                    className="plan-textarea"
                    name={`plan-section-${section.chapterNo}`}
                    value={section.body}
                    onChange={(event) => updateSection(section.chapterNo, event.target.value)}
                  />
                  <PlanSectionMeta section={section} />
                  <Button variant="ghost" size="sm" onClick={() => saveSection(section)} loading={saving}>
                    この章を保存
                  </Button>
                </Card>
              ))}
            </>
          )}
        </div>
      </div>
      {ready && (
        <div className="footer fade">
          <Button variant="primary" onClick={() => nav.go('method')}>申請方法を見る</Button>
          <div className="export-confirmation">
            <Checkbox
              checked={draftConfirmed}
              onChange={setDraftConfirmed}
              label="本人確認用の下書きであることを確認しました"
            />
          </div>
          <div className="dual-actions">
            <Button variant="secondary" onClick={() => exportFile('docx')} loading={exporting === 'docx'} disabled={!draftConfirmed}>docxで出力</Button>
            <Button variant="secondary" onClick={() => exportFile('pdf')} loading={exporting === 'pdf'} disabled={!draftConfirmed}>PDFで出力</Button>
          </div>
        </div>
      )}
    </>
  )
}

function safeDraftGenerationMessage(error = {}) {
  if (!error) return SAFE_DRAFT_GENERATION_ERROR
  const code = String(error.code || '')
  if (code.includes('BUDGET')) {
    return '下書き生成の上限に達しました。時間をおいて、もう一度お試しください。'
  }
  return SAFE_DRAFT_GENERATION_ERROR
}

export function ApplicationMethod({ nav, app }) {
  const detail = app.detail
  const match = app.selectedMatch
  if (!detail || !match) {
    return (
      <>
        <NavBar title="申請方法" left="戻る" onLeft={() => nav.back()} />
        <div className="screen"><EmptyState title="候補がありません" hint="診断結果から補助金を選んでください" /></div>
      </>
    )
  }

  return (
    <>
      <NavBar title="申請方法" left="戻る" onLeft={() => nav.back()} noBorder />
      <div className="screen fade">
        <div className="pad method-pad">
          <h1 className="method-lead">下書きができました。<br />どう進めますか？</h1>
          <p className="lead method-copy">
            専門家の確認を入れると、対象経費、必要書類、提出前の確認漏れを減らせます。
          </p>

          <div className="method-cards method-cards-sales">
            <div className="method-card">
              <div className="t">自分で準備</div>
              <div className="p"><AnimatedNumber value={74} /><small>/100</small></div>
              <div className="n">要確認が残ります</div>
            </div>
            <div className="method-card hl">
              <div className="t">専門家に相談</div>
              <div className="p"><AnimatedNumber value={91} /><small>/100</small></div>
              <div className="n">確認項目を整理</div>
            </div>
          </div>

          <Card variant="highlight" title={detail.program.name} subtitle={`補助上限 ${formatYen(detail.maxLimit)} ・ 一致 ${formatMatchScore(match)}`}>
            <p className="compact-text method-note">
              AI下書きは本人確認用の参考素材です。専門家には、下書きと要確認項目をまとめて共有できます。
            </p>
          </Card>
        </div>
      </div>
      <div className="footer">
        <Button variant="primary" onClick={() => nav.go('experts')}>専門家候補を見る</Button>
        <div style={{ marginTop: 10 }}>
          <Button variant="ghost" onClick={() => nav.tab('apply')}>申請準備を見る</Button>
        </div>
      </div>
    </>
  )
}

export function ExpertList({ nav, app }) {
  const [experts, setExperts] = useState(app.expertRecommendations || [])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (experts.length > 0 || !app.detail?.roundId) return undefined
    let cancelled = false
    setLoading(true)
    api(`/v1/experts/recommendations?roundId=${encodeURIComponent(app.detail.roundId)}&diagnosisId=${encodeURIComponent(app.diagnosis?.id || '')}`)
      .then((result) => {
        if (cancelled) return
        setExperts(result.recommendations || [])
        nav.set({ expertRecommendations: result.recommendations || [] })
      })
      .catch((err) => {
        if (!cancelled) setError(err.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [app.detail?.roundId, app.diagnosis?.id, experts.length])

  const pickExpert = (expert) => {
    nav.set({ selectedExpert: expert })
    nav.go('requestConfirm')
  }

  return (
    <>
      <NavBar title="専門家を探す" left="戻る" onLeft={() => nav.back()} noBorder />
      <div className="screen fade">
        <div className="pad experts-pad">
          <div className="section-h">この補助金に合う候補・3名</div>
          {error && <div className="error-box">{error}</div>}
          {loading && <Card title="候補を確認しています" subtitle="公開情報と制度との一致を見ています" />}
          {!loading && experts.slice(0, 3).map((expert, index) => (
            <div
              key={expert.id}
              className={`expert-card sales-expert-card ${index === 0 ? 'rec' : ''}`}
              role="button"
              tabIndex={0}
              onClick={() => pickExpert(expert)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') pickExpert(expert)
              }}
            >
              {index === 0 && <div className="rec-label">AIのおすすめ</div>}
              <div className="nm">{expert.name}</div>
              <div className="loc">{expert.serviceArea} ・ {expert.category}</div>
              <div className="rate">公開情報との一致 <b>{expert.score}/10</b></div>
              <div className="fee">相談希望の記録は¥0</div>
              <p>{expert.reasons?.[0]}</p>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

export function RequestConfirm({ nav, app }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const expert = app.selectedExpert || app.expertRecommendations?.[0]
  const detail = app.detail

  if (!expert || !detail) {
    return (
      <>
        <NavBar title="相談内容の確認" left="戻る" onLeft={() => nav.back()} />
        <div className="screen"><EmptyState title="相談候補がありません" hint="専門家候補から選んでください" /></div>
      </>
    )
  }

  const submit = async () => {
    setLoading(true)
    setError('')
    try {
      await api('/v1/leads/expert', {
        method: 'POST',
        body: {
          diagnosisId: app.diagnosis?.id,
          roundId: detail.roundId,
          expertId: expert.id,
          message: 'AI下書きと診断結果をもとに相談を希望します',
        },
      })
      nav.set({ waitlisted: true, selectedExpert: expert })
      await nav.refreshMe()
      nav.replace('requestComplete')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <NavBar title="相談内容の確認" left="戻る" onLeft={() => nav.back()} noBorder />
      <div className="screen fade">
        <div className="pad confirm-pad">
          {error && <div className="error-box">{error}</div>}
          <div className="conf-block">
            <div className="k">相談先</div>
            <div className="v">{expert.name}</div>
            <div className="s">{expert.serviceArea} ・ 公開情報との一致 {expert.score}/10</div>
          </div>
          <div className="conf-block">
            <div className="k">対象の補助金</div>
            <div className="v">{detail.program.name}</div>
            <div className="s">補助上限 {formatYen(detail.maxLimit)}</div>
          </div>
          <div className="conf-block">
            <div className="k">共有する資料</div>
            <div className="v">事業計画書（AI下書き）</div>
            <div className="s">本人確認用の参考素材です。専門家が最終確認します。</div>
          </div>
          <div className="fee-box safe-fee-box">
            <div className="fee-row">
              <span className="k">相談希望の記録</span>
              <span className="v">¥0</span>
            </div>
            <div className="fee-note">報酬、対応範囲、正式な依頼可否は専門家との確認後に決まります。</div>
          </div>
        </div>
      </div>
      <div className="footer">
        <Button variant="primary" onClick={submit} loading={loading}>この内容で相談希望を出す</Button>
      </div>
    </>
  )
}

export function RequestComplete({ nav, app }) {
  const expert = app.selectedExpert || app.expertRecommendations?.[0]
  return (
    <>
      <NavBar title="相談希望" noBorder />
      <div className="screen fade">
        <div className="complete consult-complete">
          <div className="circle" aria-hidden="true">
            <svg width="42" height="42" viewBox="0 0 24 24" fill="none">
              <path d="M5 12.5l4.5 4.5L19 7" stroke="white" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="done-h">相談希望を記録しました</div>
          <Card style={{ width: '100%', margin: '20px 0 18px' }}>
            <div className="bp-h">{expert?.name || '行政書士候補'}</div>
            <p className="compact-text">
              診断結果とAI下書きを、メッセージ画面で確認できます。正式な対応可否は専門家確認後に決まります。
            </p>
          </Card>
          <p className="lead complete-lead">次はメッセージで相談内容を確認します。</p>
          <Button variant="primary" onClick={() => nav.tab('msg')}>メッセージを見る</Button>
        </div>
      </div>
    </>
  )
}

function PlanSectionMeta({ section }) {
  const requiredDocs = section.requiredDocumentRefs || []
  const flags = section.confirmationFlags || []
  const sources = section.sources || []
  if (!requiredDocs.length && !flags.length && !sources.length) return null
  return (
    <details className="plan-meta">
      <summary>根拠と必要書類を確認する</summary>
      {requiredDocs.length > 0 && <div>必要書類: {requiredDocs.slice(0, 3).join('、')}</div>}
      {flags.length > 0 && <div>要確認: {flags.slice(0, 3).join('、')}</div>}
      {sources.length > 0 && <div>出典: {sources.slice(0, 2).map((source) => source.label).join('、')}</div>}
    </details>
  )
}

function resultLabel(result) {
  return {
    fit: '該当可能性',
    partial: '一部確認',
    needs_confirmation: '要確認',
  }[result] || result
}

function formatDate(value) {
  if (!value) return '未確認'
  return new Intl.DateTimeFormat('ja-JP').format(new Date(value))
}

function formatYen(value) {
  return `¥${Number(value || 0).toLocaleString('en-US')}`
}

function formatDays(value) {
  if (value === null || value === undefined || value === '') return '未定'
  const days = Number(value)
  return Number.isFinite(days) ? `${days}日` : '未定'
}

function formatMatchScore(match) {
  const score10 = match?.softFit?.score ?? match?.scoreBreakdown?.total10
  if (Number.isFinite(Number(score10))) return `${Number(score10).toFixed(1).replace(/\.0$/, '')}/10`
  if (Number.isFinite(Number(match?.matchScore))) return `${(Number(match.matchScore) / 10).toFixed(1)}/10`
  return '要確認'
}

function formatSubsidyRateShort(rate) {
  const value = String(rate || '').trim()
  const specialRate = value.match(/特例適用時\s*([0-9]+\/[0-9]+)/u)
  if (specialRate) return `最大${specialRate[1]}`
  const firstRate = value.match(/[0-9]+\/[0-9]+/u)
  return firstRate ? firstRate[0] : value
}

function hardRuleLabel(status) {
  return {
    eligible: 'OK',
    needs_confirmation: '要確認',
    mismatch: '不一致',
  }[status] || '要確認'
}

function hardRuleTone(status) {
  return {
    eligible: 'success',
    needs_confirmation: 'warning',
    mismatch: 'danger',
  }[status] || 'warning'
}
