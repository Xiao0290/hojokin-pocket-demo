export const DISCLAIMER =
  '本機能は、申請者ご本人による下書き作成を支援するものです。最終的な内容確認・作成・提出は、申請者ご本人、または正式に受任した専門家が行ってください。'

export const SHORT_DISCLAIMER = 'AI下書きです。提出前に必ず本人確認が必要です。'

export const seedUser = {
  id: 'usr_dev_owner',
  email: 'owner@example.test',
  displayName: '開発用ユーザー',
  role: 'owner',
}

export const companyProfileFallbacks = {
  'sample-corp.example': {
    id: 'company_sample',
    name: '株式会社サンプル商会',
    url: 'https://www.sample-corp.example',
    prefecture: null,
    city: null,
    businessSummary:
      '宿泊運営、AI業務自動化、日中貿易、金属加工、3Dプリント試作を扱う日本拠点の実行支援会社です。',
    keywords: ['宿泊運営', 'AI業務自動化', '日中貿易', '金属加工', '3Dプリント', '試作', '業務効率化'],
    unknowns: ['所在地', '従業員数', '資本金'],
    citations: [
      {
        url: 'https://sample-corp.example/ja/',
        label: '公式サイト meta description',
      },
    ],
  },
  'www.sample-corp.example': null,
}
companyProfileFallbacks['www.sample-corp.example'] = companyProfileFallbacks['sample-corp.example']

export const subsidyRounds = [
  {
    roundId: 'round_digital_ai_normal_2026',
    program: {
      id: 'program_digital_ai',
      name: 'デジタル化・AI導入補助金',
      issuer: '独立行政法人中小企業基盤整備機構',
      issuerType: 'national',
      overview:
        '中小企業・小規模事業者等が自社の課題やニーズに合ったITツールを導入するための経費の一部を補助します。',
      sourceUrl: 'https://it-shien.smrj.go.jp/applicant/subsidy/normal/',
    },
    roundLabel: '通常枠',
    status: 'open',
    acceptStart: '2026-06-01T00:00:00+09:00',
    acceptEnd: '2026-12-15T17:00:00+09:00',
    maxLimit: 4500000,
    subsidyRate: '1/2以内、2/3以内',
    adoptionRate: null,
    adoptionRateSource: null,
    lastSeenAt: '2026-06-20T00:00:00+09:00',
    keywords: ['AI', 'IT', '業務自動化', 'デジタル', '生産性', 'ソフトウェア'],
    requirements: [
      { kind: 'hard', label: '中小企業・小規模事業者等', result: 'needs_confirmation', description: '従業員数と資本金の確認が必要です。' },
      { kind: 'soft', label: 'ITツール導入', result: 'fit', description: 'AI業務自動化の記載があり、IT導入目的と近い候補です。' },
    ],
    requiredDocuments: [
      { label: '事業計画書', aiDraftable: true, checked: false },
      { label: '会社情報・履歴事項', aiDraftable: false, checked: false },
      { label: '導入予定ツールの見積書', aiDraftable: false, checked: false },
      { label: 'gBizIDプライム', aiDraftable: false, checked: false },
    ],
    steps: ['公募要領を確認', 'IT導入支援事業者と対象ツールを確認', '事業計画書の下書きを作成', '公式サイトで申請手続きを確認'],
  },
  {
    roundId: 'round_monozukuri_2026',
    program: {
      id: 'program_monozukuri',
      name: 'ものづくり補助金',
      issuer: '中小企業庁',
      issuerType: 'national',
      overview:
        '中小企業・小規模事業者等による革新的な新製品・新サービス開発や設備投資を支援します。',
      sourceUrl: 'https://portal.monodukuri-hojo.jp/about.html',
    },
    roundLabel: '製品・サービス高付加価値化枠',
    status: 'open',
    acceptStart: '2026-05-01T00:00:00+09:00',
    acceptEnd: '2026-11-30T17:00:00+09:00',
    maxLimit: 25000000,
    subsidyRate: '1/2〜2/3',
    adoptionRate: null,
    adoptionRateSource: null,
    lastSeenAt: '2026-06-20T00:00:00+09:00',
    keywords: ['金属加工', '3Dプリント', '試作', '新製品', '設備投資', '生産性'],
    requirements: [
      { kind: 'hard', label: '中小企業者等', result: 'needs_confirmation', description: '従業員数・資本金の確認が必要です。' },
      { kind: 'soft', label: '革新的サービス・試作品開発', result: 'fit', description: '金属加工と3Dプリント試作の記載があります。' },
    ],
    requiredDocuments: [
      { label: '事業計画書', aiDraftable: true, checked: false },
      { label: '設備・外注費の見積書', aiDraftable: false, checked: false },
      { label: '決算書', aiDraftable: false, checked: false },
      { label: '賃上げ計画の確認資料', aiDraftable: true, checked: false },
    ],
    steps: ['公募要領を確認', '投資内容と見積を整理', '事業計画書の下書きを作成', '公式サイトで申請手続きを確認'],
  },
  {
    roundId: 'round_shoryokuka_ippan_2026',
    program: {
      id: 'program_shoryokuka',
      name: '中小企業省力化投資補助金',
      issuer: '独立行政法人中小企業基盤整備機構',
      issuerType: 'national',
      overview:
        '人手不足の解消に向け、設備導入やシステム構築による省力化投資を支援します。',
      sourceUrl: 'https://shoryokuka.smrj.go.jp/ippan/',
    },
    roundLabel: '一般型',
    status: 'open',
    acceptStart: '2026-06-01T00:00:00+09:00',
    acceptEnd: '2026-07-31T17:00:00+09:00',
    maxLimit: 80000000,
    subsidyRate: '1/2、2/3',
    adoptionRate: null,
    adoptionRateSource: null,
    lastSeenAt: '2026-06-20T00:00:00+09:00',
    keywords: ['宿泊運営', '業務自動化', 'AI', '省力化', '設備導入', 'システム構築'],
    requirements: [
      { kind: 'hard', label: '中小企業等', result: 'needs_confirmation', description: '企業規模と人手不足状態の確認が必要です。' },
      { kind: 'soft', label: '省力化投資', result: 'fit', description: '宿泊運営とAI業務自動化は省力化投資との関連があります。' },
    ],
    requiredDocuments: [
      { label: '事業計画書', aiDraftable: true, checked: false },
      { label: '省力化投資の見積書', aiDraftable: false, checked: false },
      { label: '人手不足を示す資料', aiDraftable: false, checked: false },
      { label: '決算書', aiDraftable: false, checked: false },
    ],
    steps: ['省力化対象業務を整理', '必要設備・システムを確認', '事業計画書の下書きを作成', '公式サイトで申請手続きを確認'],
  },
  {
    roundId: 'round_jizokuka_2026',
    program: {
      id: 'program_jizokuka',
      name: '小規模事業者持続化補助金',
      issuer: '小規模事業者持続化補助金事務局',
      issuerType: 'national',
      overview:
        '小規模事業者等が経営計画を自ら策定し、販路開拓等に取り組む経費を支援します。',
      sourceUrl: 'https://official.jizokukanb.com/',
    },
    roundLabel: '一般型・通常枠',
    status: 'upcoming',
    acceptStart: '2026-11-05T00:00:00+09:00',
    acceptEnd: '2026-12-15T17:00:00+09:00',
    maxLimit: 500000,
    subsidyRate: '2/3',
    adoptionRate: null,
    adoptionRateSource: null,
    lastSeenAt: '2026-06-20T00:00:00+09:00',
    keywords: ['販路開拓', '宿泊運営', '日中貿易', 'Web', '集客', '展示会'],
    requirements: [
      { kind: 'hard', label: '小規模事業者', result: 'needs_confirmation', description: '従業員数の確認が必要です。' },
      { kind: 'soft', label: '販路開拓', result: 'fit', description: '日中貿易や宿泊運営の販路開拓に使える可能性があります。' },
    ],
    requiredDocuments: [
      { label: '経営計画・補助事業計画', aiDraftable: true, checked: false },
      { label: '見積書', aiDraftable: false, checked: false },
      { label: '事業支援計画書', aiDraftable: false, checked: false },
    ],
    steps: ['商工会・商工会議所へ相談', '販路開拓計画を整理', '下書きを作成', '公式サイトで申請手続きを確認'],
  },
  {
    roundId: 'round_shokei_ma_2026',
    program: {
      id: 'program_shokei_ma',
      name: '事業承継・M&A補助金',
      issuer: '中小企業庁',
      issuerType: 'national',
      overview:
        '事業承継やM&Aを契機とした新しい取り組み、経営資源引継ぎ、PMI等を支援します。',
      sourceUrl: 'https://www.chusho.meti.go.jp/koukai/hojyokin/kobo/2026/260522001.html',
    },
    roundLabel: '事業承継促進枠',
    status: 'open',
    acceptStart: '2026-05-22T00:00:00+09:00',
    acceptEnd: '2026-08-31T17:00:00+09:00',
    maxLimit: 8000000,
    subsidyRate: '1/2、2/3',
    adoptionRate: null,
    adoptionRateSource: null,
    lastSeenAt: '2026-06-20T00:00:00+09:00',
    keywords: ['新事業', '事業承継', 'M&A', '経営資源', '多角化', '日中貿易'],
    requirements: [
      { kind: 'hard', label: '事業承継・M&Aの予定', result: 'needs_confirmation', description: '現時点では承継予定の確認が必要です。' },
      { kind: 'soft', label: '新たな取り組み', result: 'partial', description: '複数事業の展開があり、将来の多角化計画に関連する可能性があります。' },
    ],
    requiredDocuments: [
      { label: '事業計画書', aiDraftable: true, checked: false },
      { label: '承継・M&Aに関する資料', aiDraftable: false, checked: false },
      { label: '決算書', aiDraftable: false, checked: false },
    ],
    steps: ['対象枠を確認', '承継・M&Aの予定を整理', '事業計画書の下書きを作成', '公式サイトで申請手続きを確認'],
  },
]
