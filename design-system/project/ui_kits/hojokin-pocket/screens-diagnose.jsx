/* 補助金ポケット — diagnose tab screens */
;(function () {
  const DS = window.DesignSystem_a96fc8
  const K = window.KIT
  const AN = DS.AnimatedNumber
  const { useState, useEffect } = React
  const S = (window.KIT.Screens = window.KIT.Screens || {})

  // ===== Home (診断) =====
  S.Home = function Home({ nav, app }) {
    return (
      <>
        <DS.NavBar brand />
        <div className="screen fade">
          <div className="pad">
            <p className="lead" style={{ marginTop: 4, marginBottom: 22 }}>
              会社のURLを入力すると、申請できる補助金をAIが診断します。
            </p>
            <DS.Input
              label="会社のURL"
              placeholder="https://会社のURL"
              value={app.url}
              onChange={(e) => nav.set({ url: e.target.value })}
            />
            <div style={{ marginTop: 16 }}>
              <DS.Button variant="primary" onClick={() => nav.go('diagnosing')}>
                補助金を診断する
              </DS.Button>
            </div>

            {app.hasApplied && (
              <>
                <div className="section-h" style={{ margin: '26px 0 12px' }}>申請中</div>
                <DS.Card variant="highlight" tappable onClick={() => nav.go('status')}
                  title="事業再構築補助金"
                  subtitle={`審査中 ・ 本日提出 ・ 受付番号 ${K.RECEIPT_NO}`} />
              </>
            )}

            <div className="section-h" style={{ margin: '26px 0 12px' }}>最近の診断</div>
            {app.hasApplied ? (
              <DS.Card tappable onClick={() => nav.go('results')}
                title={K.COMPANY_NAME}
                subtitle={<><AN value={K.RESULT_SUMMARY.count} suffix="件マッチ" /> ・ 上限合計 <AN value={K.RESULT_SUMMARY.totalLimit} format="yen" /> ・ たった今</>} />
            ) : (
              <DS.Card tappable onClick={() => nav.go('results')}
                title={K.INITIAL_RECENT.name}
                subtitle={<><AN value={K.INITIAL_RECENT.matches} suffix="件マッチ" /> ・ 上限合計 <AN value={K.INITIAL_RECENT.totalLimit} format="yen" /> ・ {K.INITIAL_RECENT.when}</>} />
            )}
          </div>
        </div>
      </>
    )
  }

  // ===== Diagnosing =====
  S.Diagnosing = function Diagnosing({ nav, app }) {
    const [pct, setPct] = useState(8)
    const [active, setActive] = useState(0)
    const url = app.url?.trim() ? app.url.replace(/^https?:\/\//, '').replace(/\/$/, '') : K.DEFAULT_URL
    useEffect(() => {
      const t = [
        setTimeout(() => { setPct(45); setActive(1) }, 700),
        setTimeout(() => { setPct(80); setActive(2) }, 1500),
        setTimeout(() => setPct(100), 2200),
        setTimeout(() => { nav.replace('results') }, 2800),
      ]
      return () => t.forEach(clearTimeout)
    }, [])
    return (
      <>
        <DS.NavBar title="診断中" />
        <div className="screen">
          <div className="diag-wrap">
            <DS.Spinner style={{ margin: '8px 0 22px' }} />
            <div className="diag-h">会社情報を解析しています</div>
            <div className="diag-url">{url}</div>
            <div style={{ marginBottom: 26 }}><DS.ProgressBar value={pct} /></div>
            {K.DIAGNOSE_STEPS.map((s, i) => (
              <div key={i} className={'diag-step' + (i <= active ? ' on' : '')}>
                <span className="dot" />
                <span>{s.count != null ? <><AN value={s.count} format="comma" />{s.after}</> : s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </>
    )
  }

  // ===== Results =====
  S.Results = function Results({ nav }) {
    return (
      <>
        <DS.NavBar title="診断結果" left="診断" onLeft={() => nav.home()} right="保存" />
        <div className="screen fade">
          <div className="pad">
            <div className="section-h" style={{ marginBottom: 10 }}>申請できる補助金</div>
            <div className="result-count">
              <span className="big"><AN value={K.RESULT_SUMMARY.count} suffix="件" variant="slot" /></span>
              <span className="sum">上限合計 <AN value={K.RESULT_SUMMARY.totalLimit} format="yen" variant="slot" /></span>
            </div>
            <div style={{ marginTop: 8 }}>
              {K.SUBSIDIES.map((s) => (
                <DS.SubsidyRow key={s.id} name={s.name} frame={s.frame}
                  meta={[
                    { label: '上限', value: <AN value={s.limit} format="yen" /> },
                    { label: '採択率', value: <AN value={s.adoptionRate} format="percent" /> },
                    { label: '残', value: <AN value={s.daysLeft} suffix="日" /> },
                  ]}
                  onClick={() => { nav.set({ selectedSubsidy: s }); nav.go('detail') }} />
              ))}
            </div>
          </div>
        </div>
      </>
    )
  }

  // ===== Tab roots =====
  S.ApplyRoot = function ApplyRoot({ nav, app }) {
    if (!app.hasApplied) {
      return (<><DS.NavBar title="申請" /><div className="screen"><DS.EmptyState title="申請中の補助金はありません" hint="診断から申請を始めましょう" /></div></>)
    }
    return (
      <><DS.NavBar title="申請" /><div className="screen fade"><div className="pad">
        <DS.Card variant="highlight" tappable onClick={() => nav.go('status')} title="事業再構築補助金" subtitle={`審査中 ・ 本日提出 ・ 受付番号 ${K.RECEIPT_NO}`} />
      </div></div></>
    )
  }

  S.MsgRoot = function MsgRoot({ nav, app }) {
    if (!app.engaged) {
      return (<><DS.NavBar title="メッセージ" /><div className="screen"><DS.EmptyState title="メッセージはありません" hint="専門家に依頼するとここに表示されます" /></div></>)
    }
    return (
      <><DS.NavBar title="メッセージ" /><div className="screen fade"><div className="pad">
        <DS.Card tappable onClick={() => nav.go('chat')} title={app.selectedExpert.name} subtitle="ドラフトができました。ご確認お願いします。" />
      </div></div></>
    )
  }

  S.MyPage = function MyPage({ app }) {
    return (
      <><DS.NavBar title="マイページ" /><div className="screen fade"><div className="pad">
        <div className="mp-head">
          <div className="mp-avatar">C</div>
          <div><div className="mp-name">{K.COMPANY_NAME}</div><div className="mp-mail">contact@sample-corp.example</div></div>
        </div>
        <div className="mp-row"><span>会社のURL</span><span className="v">sample-corp.example</span></div>
        <div className="mp-row"><span>所在地</span><span className="v">神奈川県</span></div>
        <div className="mp-row"><span>gBizIDプライム</span><span className="v" style={{ color: 'var(--blue-500)', fontWeight: 600 }}>連携済み</span></div>
        <div className="mp-row"><span>診断した補助金</span><span className="v">{app.hasApplied ? <AN value={8} suffix="件" /> : '0件'}</span></div>
        <div className="mp-row"><span>通知</span><span className="v">オン</span></div>
      </div></div></>
    )
  }
})()
