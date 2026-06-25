import { useEffect, useState } from 'react'
import { AnimatedNumber, Badge, Card, EmptyState, NavBar, StatCard } from '../ds.js'
import { api } from '../api.js'

export function AdminSourceReview() {
  const [review, setReview] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    api('/v1/admin/source-review')
      .then((result) => {
        if (!cancelled) setReview(result)
      })
      .catch((err) => {
        if (!cancelled) setError(err.message)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <>
      <NavBar title="出典レビュー" />
      <div className="screen fade">
        <div className="pad admin-review">
          <div className="admin-kicker">内部確認用 ・ 読み取り専用</div>
          <h1>補助金と専門家候補の出典を確認します。</h1>
          <p className="lead">
            公式出典、最終確認日、根拠不足、専門家候補の注意事項を一画面で確認します。
          </p>

          {error && <div className="error-box">{error}</div>}
          {!review && !error && <EmptyState title="出典情報を読み込んでいます" hint="ローカルAPIの読み取り専用データを確認します" />}

          {review && (
            <>
              <StatCard
                style={{ marginTop: 18 }}
                items={[
                  { k: '制度', v: <AnimatedNumber value={review.summary.subsidyCount} suffix="件" /> },
                  { k: '審査候補', v: <AnimatedNumber value={review.summary.draftRoundCount} suffix="件" /> },
                  { k: '専門家', v: <AnimatedNumber value={review.summary.expertCount} suffix="件" /> },
                  { k: '警告', v: <AnimatedNumber value={review.summary.warningsCount} suffix="件" /> },
                ]}
              />

              <Card style={{ marginTop: 12 }} title="確認方針" subtitle={review.caveat}>
                <div className="chip-row">
                  <Badge tone="neutral">{formatDate(review.reviewedDate)} 時点</Badge>
                  <Badge tone={review.summary.staleSubsidyCount > 0 ? 'warning' : 'success'}>
                    期限切れ {review.summary.staleSubsidyCount}件
                  </Badge>
                  <Badge tone={review.summary.missingEvidenceCount > 0 ? 'warning' : 'success'}>
                    根拠不足 {review.summary.missingEvidenceCount}件
                  </Badge>
                </div>
              </Card>

              {review.draftSeed?.available && (
                <Card
                  style={{ marginTop: 12 }}
                  title="Seed DB v0.1 審査候補"
                  subtitle="この候補は未公開です。管理者 review 後まで診断結果には表示しません。"
                >
                  <div className="chip-row">
                    <Badge tone="warning">未公開 {review.draftSeed.summary.roundDraftCount}件</Badge>
                    <Badge tone="neutral">Review {review.draftSeed.summary.reviewTaskCount}件</Badge>
                    <Badge tone="success">Canonical write {review.draftSeed.summary.canonicalRoundWriteCount}件</Badge>
                  </div>
                  <div className="admin-meta-list">
                    <MetaRow label="Pack" value={review.draftSeed.packId} />
                    <MetaRow label="不足" value={`${review.draftSeed.summary.missingCriticalFieldCount}フィールド`} />
                    <MetaRow label="公開可" value={`${review.draftSeed.summary.publishableCount}件`} />
                  </div>
                  {review.draftSeed.roundDrafts.slice(0, 3).map((round) => (
                    <div className="mini-row admin-evidence-row" key={round.roundKey}>
                      <span>{round.programName}<br /><small>{round.roundName}</small></span>
                      <span className="v">{round.criticalMissingFields.length > 0 ? '要確認' : '候補'}</span>
                    </div>
                  ))}
                </Card>
              )}

              <div className="section-h" style={{ margin: '24px 0 10px' }}>補助金ソース</div>
              {review.subsidySources.map((source) => (
                <Card key={source.id} style={{ marginBottom: 12 }}>
                  <div className="section-title-row">
                    <div>
                      <div className="bp-h">{source.programName}</div>
                      <p className="compact-text">{source.roundLabel}</p>
                    </div>
                    <Badge tone={source.stale || !source.evidenceComplete ? 'warning' : 'success'}>
                      {source.stale ? '要再確認' : source.evidenceComplete ? '根拠あり' : '根拠不足'}
                    </Badge>
                  </div>
                  <div className="admin-meta-list">
                    <MetaRow label="URL" value={source.sourceUrl} />
                    <MetaRow label="最終確認" value={formatDate(source.lastSeenAt)} />
                    <MetaRow label="根拠" value={`${source.evidenceCount}件 ・ 不足 ${source.evidenceMissingFields.length}件`} />
                    <MetaRow label="ライセンス" value={`${source.sourceRecord.licenseStatus} / ${source.sourceRecord.automationMode}`} />
                  </div>
                  {source.warnings.length > 0 ? (
                    source.warnings.map((warning) => (
                      <p className="warning-text" key={warning}>{warning}</p>
                    ))
                  ) : (
                    <p className="admin-ok-text">不足フィールドはありません。</p>
                  )}
                </Card>
              ))}

              <div className="section-h" style={{ margin: '24px 0 10px' }}>専門家候補ソース</div>
              {review.expertCandidates.map((expert) => (
                <Card key={expert.id} style={{ marginBottom: 12 }}>
                  <div className="section-title-row">
                    <div>
                      <div className="bp-h">{expert.name}</div>
                      <p className="compact-text">{expert.category} ・ {expert.serviceArea}</p>
                    </div>
                    <Badge tone={expert.missingFields.length > 0 ? 'warning' : 'brand-tint'}>
                      {verificationLabel(expert.verificationLevel)}
                    </Badge>
                  </div>
                  <div className="admin-meta-list">
                    <MetaRow label="URL" value={expert.sourceUrl} />
                    <MetaRow label="最終確認" value={formatDate(expert.lastSeenAt)} />
                    <MetaRow label="注意事項" value={`${expert.caveats.length}件`} />
                  </div>
                  {expert.caveats.slice(0, 2).map((caveat) => (
                    <p className="warning-text" key={caveat}>{caveat}</p>
                  ))}
                  {expert.missingFields.length > 0 && (
                    <p className="warning-text">不足フィールド: {expert.missingFields.join(', ')}</p>
                  )}
                </Card>
              ))}

              <div className="section-h" style={{ margin: '24px 0 10px' }}>監査根拠</div>
              {review.auditEvidence.slice(0, 8).map((evidence) => (
                <div className="mini-row admin-evidence-row" key={evidence.id}>
                  <span>{evidence.programName}<br /><small>{evidence.label}</small></span>
                  <span className="v">{formatDate(evidence.observedAt)}</span>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </>
  )
}

function MetaRow({ label, value }) {
  return (
    <div className="admin-meta-row">
      <span>{label}</span>
      <span>{value || '未確認'}</span>
    </div>
  )
}

function formatDate(value) {
  if (!value) return '未確認'
  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value))
}

function verificationLabel(value) {
  return {
    official_site: '公式サイト',
    unverified: '未確認',
  }[value] || value
}
