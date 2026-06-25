// 補助金ポケット — demo data (window globals for the UI kit)
window.KIT = window.KIT || {}

window.KIT.yen = (n) => '¥' + n.toLocaleString('en-US')

window.KIT.SUBSIDIES = [
  { id: 'saikochiku', name: '事業再構築補助金', frame: '成長枠', limit: 30000000, rate: '1/2', deadline: '8/29', adoptionRate: 68, daysLeft: 62, round: '成長枠・第13回公募' },
  { id: 'monozukuri', name: 'ものづくり補助金', frame: '製品・サービス高付加価値化枠', limit: 10000000, rate: '1/2', deadline: '9/12', adoptionRate: 72, daysLeft: 48, round: '製品・サービス高付加価値化枠' },
  { id: 'it', name: 'IT導入補助金', frame: '通常枠', limit: 4500000, rate: '1/2', deadline: '8/22', adoptionRate: 81, daysLeft: 30, round: '通常枠' },
  { id: 'shoryokuka', name: '中小企業省力化投資補助金', frame: '一般型', limit: 10000000, rate: '1/2', deadline: '10/3', adoptionRate: 65, daysLeft: 74, round: '一般型' },
  { id: 'jizokuka', name: '小規模事業者持続化補助金', frame: '通常枠', limit: 2000000, rate: '2/3', deadline: '8/12', adoptionRate: 79, daysLeft: 21, round: '通常枠' },
  { id: 'shoene', name: '省エネ補助金', frame: '設備更新枠', limit: 15000000, rate: '1/3', deadline: '9/30', adoptionRate: 70, daysLeft: 70, round: '設備更新枠' },
  { id: 'jigyoshokei', name: '事業承継・引継ぎ補助金', frame: '専門家活用枠', limit: 6000000, rate: '2/3', deadline: '9/5', adoptionRate: 74, daysLeft: 41, round: '専門家活用枠' },
  { id: 'career', name: 'キャリアアップ助成金', frame: '正社員化コース', limit: 800000, rate: '—', deadline: '随時', adoptionRate: 88, daysLeft: 90, round: '正社員化コース' },
]

window.KIT.RESULT_SUMMARY = { count: 8, totalLimit: 48300000 }

window.KIT.APPLY_STEPS = [
  { id: 'plan', label: '事業計画書を作成する', aiDraft: true },
  { id: 'kessan', label: '決算書を準備する（直近2期）', aiDraft: false },
  { id: 'mitsumori', label: '設備の見積書を取得する', aiDraft: false },
  { id: 'gbiz', label: 'gBizIDプライムを取得する', aiDraft: false },
  { id: 'chinage', label: '賃上げ要件を確認する', aiDraft: true },
]

window.KIT.BUSINESS_PLAN = {
  maxChars: 4200,
  sections: [
    { heading: '1. 事業の概要', body: '当社は、組込みソフトウェアおよびIoTデバイスの受託開発を主力事業とする企業である。創業以来培ってきた制御技術を強みに、製造業の生産設備向けソリューションを提供してきた。本事業では、これまでの受託開発で蓄積した知見を活かし、自社プロダクトとしてのクラウド型設備監視サービスを新たに立ち上げ、収益構造の多角化と事業の再構築を図る。' },
    { heading: '2. 事業再構築の必要性', body: '近年、受託開発市場は価格競争が激化し、案件単価の下落が続いている。一方で、製造現場ではDX需要が急速に高まっており、設備の稼働データを活用した予知保全・遠隔監視へのニーズが顕在化している。当社が下請構造から脱却し、継続的な収益を生むストック型ビジネスへ転換することは、持続的な成長のために不可欠である。' },
    { heading: '3. 市場の動向と優位性', body: '国内の設備保全市場は年率8%で拡大しており、特に中小製造業向けの安価で導入しやすい監視サービスは供給が不足している。当社は現場で実証済みの制御技術と既存顧客基盤を有しており、競合に対して導入実績と信頼性の面で明確な優位性を持つ。' },
    { heading: '4. 投資計画と資金使途', body: '本補助事業では、クラウド基盤の構築費、エッジ端末の開発費、および販売体制強化のための人材投資を行う。総事業費6,000万円のうち、補助対象経費に対して1/2の補助を受けることで、初期投資の回収期間を大幅に短縮し、早期の黒字化を実現する。' },
    { heading: '5. 収益計画と将来展望', body: 'サービス開始3年目で導入企業120社、月額課金による経常収益2億円を見込む。5年後には海外展開も視野に入れ、当社の事業ポートフォリオにおける自社プロダクト比率を50%まで引き上げることを目標とする。' },
  ],
}

window.KIT.APPLY_METHOD = { self: 68, expert: 89, gain: 21 }

window.KIT.EXPERTS = [
  { id: 'sagami', name: 'あおい行政書士事務所', area: '神奈川県', tags: '事業再構築 / ものづくり', adoptions: 124, rating: 4.9, upfront: '着手金0円', success: 20, recommended: true },
  { id: 'shonan', name: 'みどり経営サポート', area: '神奈川県', tags: '創業 / 補助金全般', adoptions: 86, rating: 4.7, upfront: '着手金0円', success: 18, recommended: false },
  { id: 'yokohama', name: 'さくら士業オフィス', area: '神奈川県', tags: 'IT導入 / 省力化', adoptions: 152, rating: 4.8, upfront: '着手金3万円', success: 15, recommended: false },
]

window.KIT.STATUS_TIMELINE = [
  { id: 1, title: '補助金を診断', sub: '8件マッチ', state: 'done' },
  { id: 2, title: '申請書を作成', sub: 'AIが事業計画書を作成', state: 'done' },
  { id: 3, title: '専門家に依頼', sub: 'あおい行政書士事務所', state: 'done' },
  { id: 4, title: '専門家レビュー完了', sub: '加点提案を反映しました', state: 'done' },
  { id: 5, title: '申請を提出', sub: '提出の準備ができました', state: 'active' },
  { id: 6, title: '採択結果を待つ', sub: '', state: 'todo' },
]

window.KIT.SUBMIT_DOCS = [
  { id: 'plan', label: '事業計画書', note: '専門家確認済み' },
  { id: 'kessan', label: '決算書（直近2期）', note: '' },
  { id: 'mitsumori', label: '設備の見積書', note: '' },
  { id: 'gbiz', label: 'gBizIDプライム連携', note: '' },
]

window.KIT.DIAGNOSE_STEPS = [
  { label: 'サイトを読み込み' },
  { label: '事業内容を解析' },
  { count: 2847, after: '制度と照合' },
]
window.KIT.RECEIPT_NO = 'R7-13-04821'
window.KIT.COMPANY_NAME = '株式会社サンプル商会'
window.KIT.DEFAULT_URL = 'sample-corp.example'
window.KIT.INITIAL_RECENT = { name: '株式会社サンプル製作所', matches: 6, totalLimit: 21500000, when: '3日前' }
