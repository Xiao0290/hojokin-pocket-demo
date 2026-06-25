# 補助金ポケット — Phase 1 MVP 技術仕様書

> 本書は「殻（クリック可能デモ）」を本実装に進める Phase 1 の設計図です。
> 前提となる2つの制約（① 改正行政書士法 2026/1 施行 ② jGrants に提出APIが無い）に
> 適合する形でスコープを切っています。アーキテクチャ全体像は別途の構成図を参照。

---

## 0. MVP の定位（最重要）

- **MVP = 「発見 → 起草支援」までの需要側 SaaS**。士業マーケットプレイス・決済・jGrants提出は **Phase 2 以降**。
- AI は **「経営者本人の下書きを助けるツール」** と位置づける（完成品の納品・代理作成ではない）。これを UI・規約・出力物のすべてで一貫させる。
- 課金は当面しない（無料 or 将来の需要側 SaaS）。**書類作成の対価を利用者から取らない**。
- 数値（採択率など）は **「制度一般の採択率＋出典」のみ**。会社個別の採択率予測（68% 等）は出さない。

---

## 1. スコープ（In / Out）

### In（Phase 1 で作る）
| # | 機能 | 対応画面 |
|---|------|----------|
| 1 | メール/SNS ログイン（gBizID 連携はしない） | — |
| 2 | 会社URL入力 → AI診断（スクレイピング→事業内容抽出→制度照合） | ①② |
| 3 | 診断結果一覧（国データ中心・出典付き一般採択率・残日数・適合度） | ③ |
| 4 | 補助金詳細（要件・補助上限/率/締切・申請の進め方チェックリスト） | ④ |
| 5 | AI事業計画書「起草支援」（上位制度のテンプレ・章立てストリーミング・章単位編集・PDF/docxエクスポート） | ⑤ |
| 6 | 締切リマインド通知（プッシュ/メール） | — |
| 7 | マイページ（診断履歴・保存・会社プロファイル編集） | — |

### Out（Phase 2 以降に延期）
- 士業マーケットプレイス（撮合・資格確認・評価・チャット）＝画面⑥⑦⑧⑨
- 成功報酬の決済・エスクロー・状態管理（Stripe Connect / eKYC）
- jGrants 提出・代理申請・受付番号取得＝画面⑩⑪（**APIが無いため自動化不可**）
- 自治体長尾データ・厚労省助成金・採択率予測モデル・会社個別採択率

> 画面⑥以降は MVP では「Coming soon（専門家に相談・近日公開）」の意思表示プレースホルダに留め、依頼意向だけを記録（waitlist）する。

---

## 2. システム構成（Phase 1）

```
需要側モバイルアプリ (Expo / React Native, 画面①〜⑤)
        │ REST + SSE
API ゲートウェイ / BFF (NestJS, AWS東京)
        ├─ 診断サービス      → Playwright ワーカー / Amazon Bedrock(Claude)
        ├─ AI計画書サービス  → Amazon Bedrock(Claude) / RAG(pgvector)
        └─ 通知サービス      → Expo Push / Amazon SES
データ層 (AWS ap-northeast-1)
        ├─ Aurora Serverless v2 (PostgreSQL + pgvector)   … 制度/診断/計画書
        ├─ OpenSearch                                     … 補助金検索
        └─ S3 (SSE暗号化)                                 … 計画書・出力・添付
データパイプライン (日次バッチ, Temporal/Dagster)
        jGrants 公開API(読取専用GET) → ETL正規化・構造化 → 制度マスタ(Aurora)
```

- **言語統一**：フロント・BFF・バックエンドすべて TypeScript（strict）。
- **LLM は Amazon Bedrock 経由（ap-northeast-1, JP Geo 推論プロファイル）**。中小企業の事業内容・決算情報という機微データを国外に出さないため。

---

## 3. データモデル / DBスキーマ（PostgreSQL）

> Phase 2 で `experts / engagements / payments / reviews` を足す前提で、ID は uuid、
> 金額は bigint（円）、時刻は timestamptz。制度は **program ⇄ round の 1対多** を厳守。

```sql
-- ============ ユーザー & 会社 ============
create table users (
  id            uuid primary key default gen_random_uuid(),
  email         text unique not null,
  auth_provider text not null,                 -- 'email' | 'google' | 'line'
  display_name  text,
  role          text not null default 'owner', -- Phase2で 'expert' 追加
  created_at    timestamptz not null default now()
);

create table companies (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references users(id),
  name            text,
  url             text not null,
  jsic_code       text,                         -- 日本標準産業分類
  prefecture      text,
  city            text,
  employees_range text,                         -- '1-5' | '6-20' | ...
  capital_range   text,
  business_phase  text,                         -- 'founding'|'growth'|'succession'|'restructuring'
  profile         jsonb,                        -- AI抽出の構造化プロファイル全体
  source_citations jsonb,                       -- どのページから判断したか(URL配列)
  analyzed_at     timestamptz,
  created_at      timestamptz not null default now()
);

-- ============ 制度マスタ（パイプラインが投入） ============
create table subsidy_programs (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  issuer       text,
  issuer_type  text not null,                   -- 'national'|'prefecture'|'city'|'mhlw'
  overview     text,
  jsic_targets text[],                          -- 対象業種コード（空=不問）
  source_url   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table subsidy_rounds (
  id                  uuid primary key default gen_random_uuid(),
  program_id          uuid not null references subsidy_programs(id),
  round_label         text,                     -- '成長枠・第13回公募' 等
  status              text not null,            -- 'upcoming'|'open'|'closed'
  accept_start        timestamptz,
  accept_end          timestamptz,              -- 残日数 = accept_end - now()
  max_limit           bigint,                   -- 補助上限(円)
  subsidy_rate        text,                     -- '1/2' '2/3' など表記そのまま
  budget              bigint,
  adoption_rate       numeric(5,2),             -- 制度一般の採択率(%)。個別予測ではない
  adoption_rate_source text,                    -- 出典URL/文書（必須・無ければ非表示）
  jgrants_id          text,                     -- jGrants側ID（同期キー）
  content_hash        text,                     -- 鮮度差分検知用
  last_seen_at        timestamptz,              -- 最終確認日（UIに表示）
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index on subsidy_rounds (status, accept_end);

-- 適格要件（hardは決定的判定／soft は加点）
create table eligibility_rules (
  id         uuid primary key default gen_random_uuid(),
  round_id   uuid not null references subsidy_rounds(id),
  kind       text not null,                     -- 'hard' | 'soft'
  label      text,
  rule       jsonb not null,                    -- JSONLogic 形式
  created_at timestamptz not null default now()
);

create table required_documents (
  id           uuid primary key default gen_random_uuid(),
  program_id   uuid not null references subsidy_programs(id),
  label        text not null,                   -- '事業計画書' '決算書(直近2期)' ...
  ai_draftable boolean not null default false,  -- 'AI下書き' タグ
  sort         int not null default 0
);

-- 制度ベクトル（粗選別RAG用）。round単位 or program単位
create table subsidy_embeddings (
  round_id  uuid primary key references subsidy_rounds(id),
  embedding vector(1024) not null
);
-- create index on subsidy_embeddings using ivfflat (embedding vector_cosine_ops);

-- ============ 診断 ============
create table diagnoses (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references users(id),
  company_id   uuid not null references companies(id),
  status       text not null default 'pending', -- pending|scraping|extracting|matching|done|failed
  input_url    text not null,
  error        text,
  match_count  int,
  total_limit  bigint,                          -- 上限合計（一覧ヘッダ）
  saved        boolean not null default false,
  started_at   timestamptz not null default now(),
  completed_at timestamptz
);

create table diagnosis_matches (
  id           uuid primary key default gen_random_uuid(),
  diagnosis_id uuid not null references diagnoses(id),
  round_id     uuid not null references subsidy_rounds(id),
  eligible     boolean not null,                -- hard要件を全て満たすか（false混入は致命的）
  match_score  numeric(5,2),                    -- 適合度（採択率予測ではない）
  reasons      jsonb,                           -- 適合/不適合の根拠（説明可能性）
  rank         int
);
create index on diagnosis_matches (diagnosis_id, rank);

-- ============ 事業計画書（起草支援） ============
create table business_plans (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references users(id),
  company_id   uuid not null references companies(id),
  round_id     uuid not null references subsidy_rounds(id),
  status       text not null default 'generating', -- generating|draft|edited|exported
  model        text,                            -- 生成モデルID（再現性）
  target_chars int default 4200,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table business_plan_sections (
  id          uuid primary key default gen_random_uuid(),
  plan_id     uuid not null references business_plans(id),
  chapter_no  int not null,
  heading     text not null,
  body        text,
  char_count  int,
  status      text not null default 'ai_draft', -- ai_draft|edited|confirmed
  sources     jsonb,                            -- 本文中の数値/固有名の根拠（入力/RAG）
  revision    int not null default 1,
  updated_at  timestamptz not null default now(),
  unique (plan_id, chapter_no)
);

-- ============ 通知 ============
create table notifications (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references users(id),
  type         text not null,                   -- 'deadline'|'diagnosis_done'|...
  payload      jsonb,
  channel      text not null,                   -- 'push'|'email'
  scheduled_at timestamptz,
  sent_at      timestamptz,
  read_at      timestamptz
);

-- ============ 取込来歴（provenance） ============
create table ingestion_runs (
  id          uuid primary key default gen_random_uuid(),
  source      text not null,                    -- 'jgrants'
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  stats       jsonb
);
create table source_records (
  id          uuid primary key default gen_random_uuid(),
  source      text not null,
  external_id text,
  raw_ref     text,                             -- S3上の原本(immutable)へのキー
  content_hash text,
  fetched_at  timestamptz not null default now()
);
```

---

## 4. API設計（REST + SSE）

> 認証は基盤（Supabase Auth / Auth0 等）に委譲し、各エンドポイントは Bearer で保護。
> 診断・計画書生成は時間がかかるため **非同期 + SSE** で進捗/逐次描画する。

| Method | Path | 概要 |
|---|---|---|
| POST | `/v1/diagnoses` | `{url}` を受け company+diagnosis を作成しジョブ投入 → `{diagnosis_id, status:"scraping"}` |
| GET | `/v1/diagnoses/{id}` | 状態とサマリ（match_count, total_limit）取得（ポーリング用） |
| GET | `/v1/diagnoses/{id}/events` | **SSE**：`scraping`→`extracting`→`matching`→`done` の進捗（画面②の演出に対応） |
| GET | `/v1/diagnoses/{id}/matches` | 結果一覧：制度名/枠/上限/補助率/締切/残日数/一般採択率(+出典)/適合度 |
| GET | `/v1/subsidies/rounds/{id}` | 補助金詳細：要件・必要書類チェックリスト・採択率(+出典) |
| POST | `/v1/business-plans` | `{company_id, round_id}` で計画書を作成しジョブ投入 → `{plan_id}` |
| GET | `/v1/business-plans/{id}` | 計画書（章配列・status） |
| GET | `/v1/business-plans/{id}/events` | **SSE**：章ごとのトークンをストリーミング（画面⑤の逐次表示） |
| PATCH | `/v1/business-plans/{id}/sections/{no}` | 章本文を本人が編集（status→`edited`） |
| POST | `/v1/business-plans/{id}/export` | `{format:"docx"\|"pdf"}` → `{file_url}`（署名付き短命URL） |
| GET | `/v1/me/diagnoses` | 診断履歴（マイページ・最近の診断） |
| PUT | `/v1/me/notifications/settings` | 通知設定 |
| POST | `/v1/leads/expert` | （Phase2待ち）「専門家に相談」意向の記録（waitlist） |

### 非同期診断フロー
```
POST /v1/diagnoses ─▶ (queue) ─▶ diagnosis-worker
   1. scraping   : Playwright で会社URL取得（本人の自社URLのみ）
   2. extracting : trafilatura→Markdown→Bedrock Claude(Structured Output)で事業プロファイル
   3. matching   : pgvectorで粗選別 → hard要件を決定的判定 → soft採点でランキング
   4. done       : diagnosis_matches 保存・summary 更新
  各ステップ完了で SSE に push（画面②の3ステップ表示と一致）
```

---

## 5. 画面 ↔ API ↔ テーブル マッピング

| 画面 | 使う API | 主なテーブル |
|---|---|---|
| ① 診断ホーム | `POST /v1/diagnoses`, `GET /v1/me/diagnoses` | companies, diagnoses |
| ② 診断中 | `GET /v1/diagnoses/{id}/events` (SSE) | diagnoses |
| ③ 診断結果 | `GET /v1/diagnoses/{id}/matches` | diagnosis_matches, subsidy_rounds, subsidy_programs |
| ④ 補助金詳細 | `GET /v1/subsidies/rounds/{id}` | subsidy_rounds, eligibility_rules, required_documents |
| ⑤ 事業計画書 | `POST /v1/business-plans`, `GET …/events`(SSE), `PATCH …/sections/{no}`, `POST …/export` | business_plans, business_plan_sections |
| ⑥〜⑪（Phase2） | `POST /v1/leads/expert`（意向記録のみ） | — |
| マイページ | `GET /v1/me/diagnoses`, `PUT /v1/me/notifications/settings` | diagnoses, companies, notifications |

---

## 6. AIパイプライン詳細

### 6-1. 診断（事業内容抽出 → 照合）
- **スクレイピング**：Playwright(headless)。robots.txt 遵守・自社UA明示・低頻度。**本人が入力した自社URLの本人指示取得に限定**（第三者一括クロールはしない）。
- **本文抽出**：trafilatura で本文→Markdown（トークン90%削減、広告/ナビ除去）。
- **構造化抽出**：Bedrock Claude（一次は `haiku`、確信度低/複雑のみ `opus` へエスカレーション）+ **Structured Outputs**。業種(JSIC)/規模/所在地/フェーズ/補助金タグを抽出、**不明は null・推測禁止**、`citations` で根拠URL保持。
- **照合（ハイブリッド）**：
  1. pgvector で 2,847制度から候補を粗選別（再現率担保）
  2. **hard 要件（地域/業種/従業員/締切）を JSONLogic で決定的判定**（不適格混入を排除＝適合率担保）
  3. soft 要件充足率＋準備度でランキング、境界の説明文だけ LLM。
- **採択率**：制度一般の `adoption_rate`(+出典) のみ表示。**会社個別の予測値は MVP では出さない**。

### 6-2. 事業計画書（起草支援）
- **生成**：Bedrock Claude `opus`（thinking high・SSEストリーミング）+ Structured Outputs で章構造（章番号/見出し/本文/字数/反映加点/根拠ID）を機械保証。
- **テンプレ駆動**：制度ごとに「生成スキーマ＋審査ルーブリック＋様式マッピング」を YAML 化。MVP は申請頻度上位（持続化・ものづくり・事業再構築）に限定。
- **RAG**：採択事例コーパス（公開採択結果＋許諾済み）を制度×業種でメタ付けし few-shot 注入。共通プレフィクスは prompt caching。
- **ヒアリング**：①の抽出結果で自動ドラフト→不足項目だけ動的に質問。本文を **確定/要確認/AI仮定** でタグ分け。
- **ガードレール**：(1)字数・必須項目・数値整合の決定的チェック、(2)数値/固有名は入力・RAG根拠に紐付け、未根拠は「要確認」へ降格、(3)`stop_reason=refusal/max_tokens` を必ず分岐。
- **出力**：python-docx で制度指定様式(.docx)へ差し込み＋PDF化。フッターに「本書はAIによる下書き素案であり、最終的な作成・確認は申請者ご本人（または受任した行政書士）が行ってください」を明記。

---

## 7. 非機能要件

### データ所在地・セキュリティ
- 全インフラ **AWS ap-northeast-1**、LLM は **Bedrock JP Geo**（データ国内）。
- 通信 TLS、保存時暗号化（S3 SSE / Aurora 暗号化）、秘密情報は Secrets Manager。
- アクセス制御はアプリ層で会社スコープ（Phase2 の RBAC を見据えた `role` 列）。
- 監査ログ（誰が何を閲覧/編集/出力したか）を append-only で記録。

### コスト / レイテンシ目安
- 1診断あたり LLM：`haiku` 一次抽出 + 必要時 `opus`、本文抽出でトークン削減 → 数円〜十数円/件。
- 診断完了：スクレイピング込みで概ね 10〜15 秒（SSE で体感を担保）。
- 計画書生成：章単位ストリーミングで初期表示を速く。Batches API で eval を 50% 安に。

### 合規ガードレール（実装必須・MVPの生命線）
1. AI出力は **「本人の下書き支援」** と UI・規約・出力フッターで明示（代理作成・代理提出と誤認させない）。
2. **会社個別の採択率予測を出さない**。制度一般採択率のみ＋出典（`adoption_rate_source` 必須）。
3. スクレイピングは **本人の自社URLのみ**、robots遵守、規約で同意取得。
4. 「提出」「代理申請」表現を Phase 1 では使わない（提出機能は未実装）。
5. 数値・実績は根拠を内部保持（不実証広告に即応できる体制 / 景表法）。
6. 本実装前に **行政書士法・景表法に強い弁護士のレビューをゲート** にする。

---

## 8. MVP 受け入れ条件 / KPI

### 受け入れ条件
- 会社URL投入 → **15秒以内に上位3〜5件**の適合補助金を提示し、**hard要件の不適格混入はゼロ**。
- 補助金詳細で要件・必要書類・残日数・一般採択率(+出典)を正確表示（残日数は日次同期）。
- 事業計画書を章立てでストリーミング生成、章単位で編集でき、PDF/docx を出力できる。
- 国データ（jGrants公開API）で制度マスタを実体化し、`last_seen_at`（最終確認日）をUI表示。

### 主要 KPI
- 診断完了率（URL投入→結果表示）／結果から詳細閲覧率
- 計画書 生成 → 本人編集 率（＝起草支援としての実利用）
- 7日 / 30日 リテンション、締切アラート経由の再訪
- （Phase2前哨）「専門家に相談」意向の取得数（waitlist）

---

## 9. Phase 2 への布石（前方互換）

- DBは `experts / engagements / payments / reviews / messages` を後付けできる形（uuid・role列・状態列）に。
- 提出層は **アダプタとして抽象化**（将来 jGrants 提出APIが開放されたら差し替え可能に）。`SubmissionAdapter` インターフェースを切っておく。
- 計画書の章・版管理は士業レビュー（差分・承認）を見据えた `revision` を MVP から保持。
- 採択率は将来「自社の申請→採否」実測へ移行できるよう、結果ラベルを貯めるスキーマ余地を確保。

---

*作成: Phase 1 設計時点。法令（行政書士法 2026/1 施行・景表法）と jGrants/gBizID 仕様は実装直前に一次情報で再確認すること。*
