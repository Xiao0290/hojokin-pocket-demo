/* 補助金ポケット — apply (detail / business plan / method) screens */
;(function () {
  const DS = window.DesignSystem_a96fc8
  const K = window.KIT
  const AN = DS.AnimatedNumber
  const { useState, useEffect, useRef } = React
  const S = (window.KIT.Screens = window.KIT.Screens || {})

  // ===== Subsidy detail =====
  S.SubsidyDetail = function SubsidyDetail({ nav, app }) {
    const s = app.selectedSubsidy
    const [checked, setChecked] = useState({})
    const doneCount = Object.values(checked).filter(Boolean).length
    return (
      <>
        <DS.NavBar title={s.name} left="結果" onLeft={() => nav.back()} />
        <div className="screen fade">
          <div className="pad">
            <DS.StatCard items={[
              { k: '補助上限', v: <AN value={s.limit} format="yen" /> },
              { k: '補助率', v: s.rate },
              { k: '締切', v: s.deadline },
            ]} />
            <div className="steps-head">
              <span className="section-h">申請の進め方</span>
              <span className="r">{doneCount} / {K.APPLY_STEPS.length} 完了</span>
            </div>
            {K.APPLY_STEPS.map((st) => (
              <DS.Checkbox key={st.id} label={st.label} aiTag={st.aiDraft}
                checked={!!checked[st.id]}
                onChange={(v) => setChecked((c) => ({ ...c, [st.id]: v }))} />
            ))}
          </div>
        </div>
        <div className="footer">
          <DS.Button variant="primary" onClick={() => nav.go('plan')}>申請書をAIで作成する</DS.Button>
        </div>
      </>
    )
  }

  // ===== Business plan (AI streaming) =====
  function buildBlocks() {
    const blocks = []
    for (const sec of K.BUSINESS_PLAN.sections) {
      blocks.push({ type: 'h', text: sec.heading })
      blocks.push({ type: 'p', text: sec.body })
    }
    return blocks
  }

  S.BusinessPlan = function BusinessPlan({ nav }) {
    const blocks = useRef(buildBlocks()).current
    const totalChars = useRef(blocks.reduce((a, b) => a + b.text.length, 0)).current
    const [shown, setShown] = useState(0)
    const done = shown >= totalChars
    useEffect(() => {
      if (done) return
      const id = setInterval(() => setShown((s) => Math.min(s + 7, totalChars)), 22)
      return () => clearInterval(id)
    }, [done, totalChars])
    const displayCount = Math.round((shown / totalChars) * K.BUSINESS_PLAN.maxChars)
    let consumed = 0
    const rendered = blocks.map((b, i) => {
      const remaining = shown - consumed
      const n = Math.max(0, Math.min(remaining, b.text.length))
      consumed += b.text.length
      if (n <= 0) return null
      const partial = n < b.text.length
      const text = b.text.slice(0, n)
      return b.type === 'h'
        ? <div className="bp-h" key={i}>{text}{partial && <span className="caret" />}</div>
        : <div className="bp-b" key={i}>{text}{partial && <span className="caret" />}</div>
    })
    return (
      <>
        <DS.NavBar title="事業計画書" left="戻る" onLeft={() => nav.back()} right={done ? '保存' : undefined} />
        <div className="screen">
          <div className="pad">
            <div className="bp-status">
              <span className="l"><span className={'dot' + (done ? '' : ' live')} />{done ? 'AIが作成しました' : 'AIが作成しています'}</span>
              <span className="c">{displayCount.toLocaleString()} / {K.BUSINESS_PLAN.maxChars.toLocaleString()} 字</span>
            </div>
            {rendered}
          </div>
        </div>
        {done && (
          <div className="footer fade">
            <DS.Button variant="primary" onClick={() => nav.go('method')}>次へ</DS.Button>
          </div>
        )}
      </>
    )
  }

  // ===== Apply method (68% vs 89%) =====
  S.ApplyMethod = function ApplyMethod({ nav }) {
    return (
      <>
        <DS.NavBar title="申請方法" left="戻る" onLeft={() => nav.back()} />
        <div className="screen fade">
          <div className="pad">
            <div className="method-h">申請書ができました。<br />どう進めますか？</div>
            <p className="lead">専門家のチェックを入れると、採択率が上がります。</p>
            <div className="method-cards">
              <div className="method-card">
                <div className="t">自分で申請</div>
                <div className="p"><AN value={K.APPLY_METHOD.self} variant="slot" /><small>%</small></div>
                <div className="n">想定採択率</div>
              </div>
              <div className="method-card hl">
                <div className="t">専門家に依頼</div>
                <div className="p"><AN value={K.APPLY_METHOD.expert} variant="slot" /><small>%</small></div>
                <div className="n">+<AN value={K.APPLY_METHOD.gain} />pt 上がる</div>
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <DS.Button variant="primary" onClick={() => nav.go('expert')}>専門家に依頼する</DS.Button>
            </div>
            <DS.Button variant="ghost" onClick={() => { nav.set({ hasApplied: true }); nav.go('status') }}>
              自分でこのまま申請する
            </DS.Button>
          </div>
        </div>
      </>
    )
  }
})()
