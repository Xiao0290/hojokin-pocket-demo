const baseDate = '2026-06-20'

function scenario({
  id,
  name,
  url,
  prefecture,
  city,
  summary,
  keywords,
  facts,
  unknowns = ['資本金', '直近決算', '補助対象経費の見積'],
  expectedPrimaryRoundId,
  minMatches = 4,
  minTopTotal10 = 8.5,
}) {
  const canonicalUrl = url.replace(/\/?$/, '/')
  return {
    id,
    fixtureType: 'synthetic-development-company',
    url,
    expected: {
      primaryRoundId: expectedPrimaryRoundId,
      minMatches,
      minTopTotal10,
      requiredKeywords: keywords.slice(0, 2),
    },
    profile: {
      id: `synthetic_${id}`,
      name,
      url,
      canonicalUrl,
      prefecture,
      city,
      businessSummary: summary,
      keywords,
      unknowns,
      citations: [
        {
          url: canonicalUrl,
          label: '開発用合成公式サイト',
          sourceType: 'synthetic_official_site',
        },
      ],
    },
    html: syntheticHtml({ name, canonicalUrl, summary, facts, keywords }),
  }
}

function syntheticHtml({ name, canonicalUrl, summary, facts, keywords }) {
  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <title>${name}</title>
  <link rel="canonical" href="${canonicalUrl}">
  <meta name="description" content="${summary}">
  <meta property="og:title" content="${name}">
  <meta property="og:description" content="${summary}">
</head>
<body>
  <main>
    <h1>${name}</h1>
    <p>${summary}</p>
    <h2>事業内容</h2>
    <p>${facts.join(' ')}</p>
    <h2>導入・投資予定</h2>
    <p>${keywords.join('、')}に関する改善計画を検討しています。見積、従業員数、資本金は本人確認後に確定します。</p>
  </main>
</body>
</html>`
}

export const syntheticCompanyScenarios = [
  scenario({
    id: 'sakura-stay',
    name: '株式会社さくらステイ運営',
    url: 'https://synthetic-sakura-stay.example/',
    prefecture: '京都府',
    city: '京都市',
    summary: '京都市内でホテルと民泊の宿泊運営を行い、清掃管理、予約対応、在庫確認の省力化とAI活用を進める小規模事業者です。',
    keywords: ['宿泊運営', '省力化', 'AI', 'システム構築', 'ホテル管理', '人手不足'],
    facts: [
      '所在地は京都府京都市、従業員数は12名です。',
      '宿泊運営では清掃指示、チェックイン対応、備品補充を手作業で管理しています。',
      'AIとシステム構築で人手不足を補い、現場作業時間を削減する計画があります。',
    ],
    expectedPrimaryRoundId: 'shoryokuka-ippan-7',
    minTopTotal10: 9,
  }),
  scenario({
    id: 'kitsune-cloud',
    name: 'キツネクラウド株式会社',
    url: 'https://synthetic-kitsune-cloud.example/',
    prefecture: '東京都',
    city: '渋谷区',
    summary: '中小企業向けに会計、販売管理、問い合わせ対応を連携するクラウド型AI業務自動化サービスを開発しています。',
    keywords: ['ITツール', 'クラウド', 'AI', 'DX', '業務プロセス', '会計', '販売管理', 'セキュリティ'],
    facts: [
      '所在地は東京都渋谷区、従業員数は18名です。',
      'クラウド、会計、販売管理、AI問い合わせ対応を一つの業務プロセスとして提供します。',
      'SECURITY ACTION自己宣言とIT導入支援事業者との連携を検討しています。',
    ],
    expectedPrimaryRoundId: 'it-digital-ai-2026-normal-3',
    minTopTotal10: 9.5,
  }),
  scenario({
    id: 'hayate-machining',
    name: '株式会社ハヤテ精密加工',
    url: 'https://synthetic-hayate-machining.example/',
    prefecture: '大阪府',
    city: '東大阪市',
    summary: '金属加工、切削、3Dプリント試作を行う製造業で、AI検査、IoTセンサー、受注管理の設備投資・省力化を検討しています。',
    keywords: ['金属加工', '3Dプリント', '試作', '設備投資', '省力化', '新製品開発', 'AI', 'IoT', 'センサー'],
    facts: [
      '所在地は大阪府東大阪市、従業員数は24名です。',
      '金属加工と3Dプリント試作の受注が増え、検品と見積作成がボトルネックになっています。',
      '新製品開発と省力化に向けてAI検査装置、IoTセンサー、受注管理システム、設備投資を検討しています。',
    ],
    expectedPrimaryRoundId: 'shoryokuka-ippan-7',
    minTopTotal10: 8.5,
  }),
  scenario({
    id: 'matsuri-market',
    name: '合同会社まつりマーケット',
    url: 'https://synthetic-matsuri-market.example/',
    prefecture: '福岡県',
    city: '福岡市',
    summary: '地域食品と雑貨のEC販売を行い、Webサイト改善、広告、展示会出展、新商品開発による販路開拓を計画しています。',
    keywords: ['販路開拓', 'Webサイト', '広告', '展示会', '新商品開発', '小規模事業者'],
    facts: [
      '所在地は福岡県福岡市、従業員数は4名です。',
      '地域食品と雑貨のEC販売で、Webサイト、広告、展示会を組み合わせた販路開拓を検討しています。',
      '新商品開発のためのパッケージ試作と撮影、LP改善を予定しています。',
    ],
    expectedPrimaryRoundId: 'jizokuka-normal-20',
    minTopTotal10: 9,
  }),
  scenario({
    id: 'minato-trade',
    name: 'ミナト日中貿易株式会社',
    url: 'https://synthetic-minato-trade.example/',
    prefecture: '兵庫県',
    city: '神戸市',
    summary: '日中貿易、輸入、海外展示会、越境ECを扱う商社で、Web販路開拓と受発注DXを進めています。',
    keywords: ['日中貿易', '販路開拓', 'Webサイト', '展示会', 'DX', 'クラウド'],
    facts: [
      '所在地は兵庫県神戸市、従業員数は9名です。',
      '日中貿易と輸入商材の販路開拓で海外展示会、Webサイト、越境ECを活用しています。',
      '受発注DXとクラウド管理を導入し、見積と在庫確認の効率化を目指します。',
    ],
    expectedPrimaryRoundId: 'jizokuka-normal-20',
    minTopTotal10: 8.5,
  }),
  scenario({
    id: 'shiro-clean',
    name: 'シロクリーンサービス株式会社',
    url: 'https://synthetic-shiro-clean.example/',
    prefecture: '北海道',
    city: '札幌市',
    summary: 'ホテル清掃と施設管理を受託し、人手不足に対応するため清掃ロボット、IoTセンサー、シフト自動化を検討しています。',
    keywords: ['省力化', '人手不足', 'ロボット', 'IoT', 'センサー', 'システム構築'],
    facts: [
      '所在地は北海道札幌市、従業員数は32名です。',
      'ホテル清掃と施設管理で人手不足が続き、清掃ロボットとIoTセンサーを検討しています。',
      'シフト自動化と現場報告システム構築により、移動と確認作業を削減する計画です。',
    ],
    expectedPrimaryRoundId: 'shoryokuka-ippan-7',
    minTopTotal10: 9.3,
  }),
  scenario({
    id: 'aoba-cafe',
    name: '青葉カフェ合同会社',
    url: 'https://synthetic-aoba-cafe.example/',
    prefecture: '宮城県',
    city: '仙台市',
    summary: '地域食材を使う小規模カフェで、テイクアウト新商品、Web予約、SNS広告による販路開拓を進めています。',
    keywords: ['販路開拓', '新商品開発', '広告', 'Webサイト', '小規模事業者'],
    facts: [
      '所在地は宮城県仙台市、従業員数は3名です。',
      'テイクアウト新商品を開発し、WebサイトとSNS広告で販路開拓を行う予定です。',
      '商工会議所への相談と事業支援計画書の準備が必要です。',
    ],
    expectedPrimaryRoundId: 'jizokuka-normal-20',
    minTopTotal10: 9,
  }),
  scenario({
    id: 'takumi-succession',
    name: '株式会社匠承継工房',
    url: 'https://synthetic-takumi-succession.example/',
    prefecture: '愛知県',
    city: '名古屋市',
    summary: '親族内承継を予定する木工・内装会社で、後継者主導の設備投資、PMI、M&A相談を検討しています。',
    keywords: ['事業承継', 'M&A', 'PMI', '後継者', '設備投資'],
    facts: [
      '所在地は愛知県名古屋市、従業員数は16名です。',
      '代表交代に向けた事業承継計画があり、後継者が新設備導入と販路整理を進めています。',
      'M&AやPMIの専門家相談も候補として検討しています。',
    ],
    expectedPrimaryRoundId: 'shoukei-ma-15',
    minTopTotal10: 9.5,
  }),
  scenario({
    id: 'hikari-logistics',
    name: 'ヒカリ物流改善株式会社',
    url: 'https://synthetic-hikari-logistics.example/',
    prefecture: '埼玉県',
    city: '川口市',
    summary: '倉庫内のピッキング、検品、配送手配を行う物流会社で、IoT、センサー、AIによる省力化を計画しています。',
    keywords: ['省力化', '人手不足', 'IoT', 'センサー', 'AI', 'システム構築'],
    facts: [
      '所在地は埼玉県川口市、従業員数は45名です。',
      'ピッキング、検品、配送手配を手作業で管理しており、人手不足が課題です。',
      'IoTセンサー、AI予測、倉庫管理システム構築で省力化を進めます。',
    ],
    expectedPrimaryRoundId: 'shoryokuka-ippan-7',
    minTopTotal10: 9.3,
  }),
  scenario({
    id: 'rindo-wellness',
    name: 'りんどうウェルネス株式会社',
    url: 'https://synthetic-rindo-wellness.example/',
    prefecture: '長野県',
    city: '松本市',
    summary: '予約制の健康相談サービスを運営し、予約管理、顧客対応、会計をクラウド化するDX投資を検討しています。',
    keywords: ['ITツール', 'クラウド', 'DX', '会計', '業務プロセス', '販売管理'],
    facts: [
      '所在地は長野県松本市、従業員数は7名です。',
      '予約管理、顧客対応、会計処理を別々の表計算で運用しています。',
      'クラウド型ITツールで業務プロセスを統合し、セキュリティを高める計画です。',
    ],
    expectedPrimaryRoundId: 'it-digital-ai-2026-normal-3',
    minTopTotal10: 9.5,
  }),
  scenario({
    id: 'kobushi-farm',
    name: 'こぶしファーム株式会社',
    url: 'https://synthetic-kobushi-farm.example/',
    prefecture: '山梨県',
    city: '北杜市',
    summary: '農産物加工と直販を行い、新商品開発、展示会、Webサイト、広告を組み合わせた販路開拓を進めています。',
    keywords: ['販路開拓', '新商品開発', '展示会', 'Webサイト', '広告'],
    facts: [
      '所在地は山梨県北杜市、従業員数は6名です。',
      '農産物加工品の新商品開発と展示会出展を計画しています。',
      'Webサイト改善と広告配信で直販比率を高めます。',
    ],
    expectedPrimaryRoundId: 'jizokuka-normal-20',
    minTopTotal10: 9,
  }),
  scenario({
    id: 'mirai-maintenance',
    name: 'ミライ設備メンテナンス株式会社',
    url: 'https://synthetic-mirai-maintenance.example/',
    prefecture: '神奈川県',
    city: '横浜市',
    summary: '施設設備の保守点検を行い、現場報告、見積、請求、部材在庫をクラウドとAIで一体管理する計画です。',
    keywords: ['ITツール', 'クラウド', 'AI', '業務プロセス', '販売管理', '会計', '省力化'],
    facts: [
      '所在地は神奈川県横浜市、従業員数は28名です。',
      '現場報告、見積、請求、部材在庫を個別管理しており、二重入力が発生しています。',
      'クラウド、AI、販売管理、会計連携を導入し、業務プロセスを改善します。',
    ],
    expectedPrimaryRoundId: 'it-digital-ai-2026-normal-3',
    minTopTotal10: 9.5,
  }),
  scenario({
    id: 'asahi-retail',
    name: '朝日リテール株式会社',
    url: 'https://synthetic-asahi-retail.example/',
    prefecture: '千葉県',
    city: '柏市',
    summary: '複数店舗の小売業で、POS、在庫、会計、販売管理をクラウド化し、セキュリティ対策も進めています。',
    keywords: ['ITツール', 'クラウド', 'DX', '販売管理', '会計', 'セキュリティ'],
    facts: [
      '所在地は千葉県柏市、従業員数は21名です。',
      'POS、在庫、会計、販売管理が分断され、月次集計に時間がかかっています。',
      'クラウド化とセキュリティ対策を含むDX投資を予定しています。',
    ],
    expectedPrimaryRoundId: 'it-digital-ai-2026-normal-3',
    minTopTotal10: 9.5,
  }),
  scenario({
    id: 'kyo-machiya',
    name: '京町家インバウンド株式会社',
    url: 'https://synthetic-kyo-machiya.example/',
    prefecture: '京都府',
    city: '京都市',
    summary: '町家宿泊施設を運営し、宿泊運営の省力化、Web集客、予約管理、清掃管理の改善を検討しています。',
    keywords: ['宿泊運営', '省力化', 'Webサイト', '販路開拓', 'ホテル管理', 'システム構築'],
    facts: [
      '所在地は京都府京都市、従業員数は8名です。',
      '宿泊運営、Web集客、予約管理、清掃管理を少人数で行っています。',
      '省力化システム構築と販路開拓の両面で投資を検討しています。',
    ],
    expectedPrimaryRoundId: 'jizokuka-normal-20',
    minTopTotal10: 8,
  }),
  scenario({
    id: 'quiet-holding',
    name: 'クワイエットホールディング合同会社',
    url: 'https://synthetic-quiet-holding.example/',
    prefecture: null,
    city: null,
    summary: '公開サイトには会社名と問い合わせ導線だけがあり、事業内容、所在地、従業員数、投資予定がほとんど確認できません。',
    keywords: [],
    facts: [
      '会社紹介は準備中です。',
      '所在地、従業員数、資本金、投資予定は公開サイトから確認できません。',
      '補助金候補は表示できますが、追加ヒアリングが必要です。',
    ],
    unknowns: ['所在地', '従業員数', '資本金', '事業内容', '投資予定', '補助対象経費の見積'],
    expectedPrimaryRoundId: 'it-digital-ai-2026-normal-3',
    minTopTotal10: 5.5,
  }),
]

export const syntheticCompanyFixtureMeta = {
  schema: 'hojokin-pocket.synthetic-companies.v1',
  fixtureType: 'development-only',
  generatedAt: `${baseDate}T12:00:00+09:00`,
  count: syntheticCompanyScenarios.length,
  notice: '合成会社データです。実在企業を示すものではなく、診断・候補表示・下書き生成のローカル検証だけに使用します。',
}
