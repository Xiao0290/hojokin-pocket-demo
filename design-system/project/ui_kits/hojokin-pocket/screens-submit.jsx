/* 補助金ポケット — submit (status / submit / complete) screens */
;(function () {
  const DS = window.DesignSystem_a96fc8
  const K = window.KIT
  const S = (window.KIT.Screens = window.KIT.Screens || {})

  const Check = ({ size = 14 }) => (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )

  // ===== Apply status (timeline) =====
  S.ApplyStatus = function ApplyStatus({ nav, app }) {
    const s = app.selectedSubsidy
    return (
      <>
        <DS.NavBar title="申請状況" left onLeft={() => nav.back()} />
        <div className="screen fade">
          <div className="pad">
            <div className="tl-sub">{s.name}</div>
            <div className="tl-title">{s.round}</div>
            <DS.Timeline items={K.STATUS_TIMELINE.map((i) => ({ title: i.title, sub: i.sub, state: i.state }))} />
          </div>
        </div>
        <div className="footer">
          <DS.Button variant="primary" onClick={() => nav.go('submit')}>申請を提出する</DS.Button>
        </div>
      </>
    )
  }

  // ===== Submit (jGrants) =====
  S.Submit = function Submit({ nav }) {
    return (
      <>
        <DS.NavBar title="申請を提出" left="戻る" onLeft={() => nav.back()} />
        <div className="screen fade">
          <div className="pad">
            <div className="submit-h"><span className="jg">jGrants</span>に提出します</div>
            <p className="lead" style={{ marginBottom: 12 }}>提出物はすべて揃っています。</p>
            {K.SUBMIT_DOCS.map((d) => (
              <div className="doc-row" key={d.id}>
                <span className="cb"><Check /></span>
                <span className="lbl">{d.label}</span>
                {d.note && <span className="note">{d.note}</span>}
              </div>
            ))}
          </div>
        </div>
        <div className="footer">
          <DS.Button variant="primary" onClick={() => nav.go('complete')}>
            <span><span className="jg" style={{ color: '#cfe0ff' }}>jGrants</span>に提出する</span>
          </DS.Button>
        </div>
      </>
    )
  }

  // ===== Complete =====
  S.Complete = function Complete({ nav }) {
    return (
      <>
        <DS.NavBar title="提出完了" noBorder />
        <div className="complete fade">
          <div className="circle"><Check size={42} /></div>
          <div className="done-h">申請を提出しました</div>
          <div className="receipt">受付番号 {K.RECEIPT_NO}</div>
          <div className="note-box">審査結果は2〜3ヶ月後に通知されます。<br />進捗はアプリでお知らせします。</div>
          <DS.Button variant="primary" onClick={() => { nav.set({ hasApplied: true }); nav.home() }}>ホームに戻る</DS.Button>
        </div>
      </>
    )
  }
})()
