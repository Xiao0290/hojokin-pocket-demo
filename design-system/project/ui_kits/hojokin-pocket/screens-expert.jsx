/* 補助金ポケット — expert (find / confirm / chat) screens */
;(function () {
  const DS = window.DesignSystem_a96fc8
  const K = window.KIT
  const AN = DS.AnimatedNumber
  const { useState } = React
  const S = (window.KIT.Screens = window.KIT.Screens || {})

  // ===== Find expert =====
  S.FindExpert = function FindExpert({ nav, app }) {
    const s = app.selectedSubsidy
    return (
      <>
        <DS.NavBar title="専門家を探す" left="戻る" onLeft={() => nav.back()} />
        <div className="screen fade">
          <div className="pad">
            <p className="section-h" style={{ marginBottom: 14 }}>{s.name}に強い専門家 ・ <AN value={K.EXPERTS.length} suffix="名" /></p>
            {K.EXPERTS.map((ex) => (
              <div key={ex.id} className={'expert-card' + (ex.recommended ? ' rec' : '')}
                onClick={() => { nav.set({ selectedExpert: ex }); nav.go('confirm') }}>
                {ex.recommended && <div style={{ marginBottom: 8 }}><DS.Badge tone="solid">AIのおすすめ</DS.Badge></div>}
                <div className="nm">{ex.name}</div>
                <div className="loc">{ex.area} ・ {ex.tags}</div>
                <div className="rate">採択 <b><AN value={ex.adoptions} suffix="件" /></b>　評価 <b><AN value={ex.rating} decimals={1} /></b></div>
                <div className="fee">{ex.upfront} ＋ 成功報酬 <AN value={ex.success} format="percent" /></div>
              </div>
            ))}
          </div>
        </div>
      </>
    )
  }

  // ===== Confirm request =====
  S.ConfirmRequest = function ConfirmRequest({ nav, app }) {
    const ex = app.selectedExpert
    const s = app.selectedSubsidy
    return (
      <>
        <DS.NavBar title="依頼内容の確認" left="戻る" onLeft={() => nav.back()} />
        <div className="screen fade">
          <div className="pad">
            <div className="conf-block">
              <div className="k">依頼先</div>
              <div className="v">{ex.name}</div>
              <div className="s">{ex.area} ・ 採択実績<AN value={ex.adoptions} suffix="件" /></div>
            </div>
            <div className="conf-block">
              <div className="k">対象の補助金</div>
              <div className="v">{s.name}</div>
              <div className="s">補助上限 <AN value={s.limit} format="yen" /></div>
            </div>
            <div className="conf-block">
              <div className="k">提出する書類</div>
              <div className="v">事業計画書（AI作成済み）</div>
              <div className="s"><AN value={K.BUSINESS_PLAN.maxChars} format="comma" suffix="字" /> ・ 専門家が最終調整します</div>
            </div>
            <div className="fee-box">
              <div className="fee-row"><span className="k">着手金</span><span className="v">{ex.upfront === '着手金0円' ? <AN value={0} format="yen" /> : <AN value={30000} format="yen" />}</span></div>
              <div className="fee-row"><span className="k">成功報酬</span><span className="v blue">採択額の<AN value={ex.success} format="percent" /></span></div>
              <div className="fee-note">採択された場合のみのお支払いです。不採択なら費用はかかりません。</div>
            </div>
          </div>
        </div>
        <div className="footer">
          <DS.Button variant="primary" onClick={() => { nav.set({ engaged: true }); nav.go('chat') }}>この内容で依頼する</DS.Button>
        </div>
      </>
    )
  }

  // ===== Chat =====
  const INITIAL_MSGS = [
    { who: 'sys', text: '事業計画書を共有しました' },
    { who: 'me', text: 'ドラフトができました。ご確認お願いします。' },
  ]

  S.Chat = function Chat({ nav, app }) {
    const ex = app.selectedExpert
    const [msgs, setMsgs] = useState(INITIAL_MSGS)
    const [text, setText] = useState('')
    const [replied, setReplied] = useState(false)
    const send = () => {
      if (!text.trim()) return
      setMsgs((m) => [...m, { who: 'me', text }])
      setText('')
      if (!replied) {
        setReplied(true)
        setTimeout(() => setMsgs((m) => [...m, { who: 'them', text: '承知しました。加点につながる箇所を調整して、提出準備まで進めますね。' }]), 900)
      }
    }
    return (
      <>
        <DS.NavBar title={ex.name} left onLeft={() => nav.back()} />
        <div className="chat-screen">
          <div className="chat-body">
            <div className="chat-day">今日</div>
            {msgs.map((m, i) =>
              m.who === 'sys'
                ? <DS.ChatBubble key={i} variant="system">{m.text}</DS.ChatBubble>
                : <DS.ChatBubble key={i} from={m.who === 'them' ? 'them' : 'me'}>{m.text}</DS.ChatBubble>
            )}
          </div>
          <div className="chat-input">
            <input placeholder="メッセージを入力" value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && send()} />
            <span className="send" onClick={send}>送信</span>
          </div>
        </div>
        <div className="footer" style={{ paddingTop: 0 }}>
          <DS.Button variant="primary" onClick={() => { nav.set({ hasApplied: true }); nav.go('status') }}>申請状況へ進む</DS.Button>
        </div>
      </>
    )
  }
})()
