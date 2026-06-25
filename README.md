# 補助金ポケット

補助金ポケットは、日本の中小企業向けに、会社 URL から補助金候補と申請準備項目を整理する Phase 1 MVP です。

会社サイトの公開情報を確認し、事業内容、候補制度、必要書類、出典、確認が必要な項目を表示します。AI は申請者ご本人の下書き支援に限定し、最終確認、作成、公式手続きは申請者ご本人または正式に受任した専門家が行います。

> **このリポジトリについて**: デモ／ポートフォリオ用途の公開版です。収録データはすべて架空で、金額・候補の表示は概算の参考情報です。採択・受給を保証するものではなく、本番運用は想定していません。

| 診断結果（デスクトップ） | 補助金詳細（モバイル） |
| :---: | :---: |
| <img src="docs/screenshots/result-desktop.png" alt="診断結果画面" width="520"> | <img src="docs/screenshots/detail-mobile.png" alt="補助金詳細画面" width="240"> |

## Phase 1 の範囲

- 開発用ログイン
- 自社サイト URL の入力と本人申告
- 会社情報の抽出と補助金候補の診断
- 補助金詳細、要件、必要書類、公式サイト出典の表示
- 事業計画書の下書き支援、章ごとの本人編集、保存
- DOCX / PDF エクスポート
- 行政書士候補の表示と相談希望 waitlist
- 通知設定と監査ログ
- ローカル E2E と品質スコア検証

Phase 1 では、専門家との契約、決済、公式電子申請、会社個別の採択可能性予測は扱いません。

## 起動方法

```bash
npm install
npm run dev:api
npm run dev:web
```

ブラウザで `http://127.0.0.1:5173/` を開きます。

## 検証

```bash
npm run test
npm run test:synthetic
npm run score:phase1
npm run score:multidim
npm run build
npm run test:e2e
```

まとめて確認する場合:

```bash
npm run verify:ci
```

## Alpha Foundation / Gate B

`v0.2-alpha-foundation` closes the local Closed Beta foundation gate for
Postgres, AuthContext, tenant scope, ObjectStoragePort, and audit logs. See:

- `docs/release-notes/v0.2-alpha-foundation.md`
- `docs/runbooks/auth-boundary.md`
- `docs/runbooks/export-storage.md`
- `docs/postgres-store-adapter.md`
- `docs/audit-log-contract.md`

Local JSON remains the default store. To test the opt-in local Postgres adapter:

```bash
docker compose up -d postgres
DATABASE_URL=postgres://hojokin:hojokin_local_only@localhost:54329/hojokin_pocket npm run db:validate
DATABASE_URL=postgres://hojokin:hojokin_local_only@localhost:54329/hojokin_pocket ALLOW_DB_MUTATION=1 npm run db:migrate
STORE_BACKEND=postgres DATABASE_URL=postgres://hojokin:hojokin_local_only@localhost:54329/hojokin_pocket ALLOW_DB_MUTATION=1 npm run db:seed
STORE_BACKEND=postgres DATABASE_URL=postgres://hojokin:hojokin_local_only@localhost:54329/hojokin_pocket npm run dev:api
```

Do not point these commands at production or customer data. The foundation gate
does not introduce marketplace behavior, success-fee, platform take-rate, proxy
drafting/submission, jGrants POST, or a production `SubmissionAdapter`.

## 主な画面

| 画面 | ファイル | 役割 |
| --- | --- | --- |
| ログイン / 診断ホーム | `src/App.jsx`, `src/screens/home.jsx` | 開発ログイン、自社サイト URL 入力、本人申告 |
| 診断中 / 結果一覧 | `src/screens/diagnose.jsx` | SSE 進捗、補助金候補、理由、警告 |
| 補助金詳細 / 事業計画書 | `src/screens/detail.jsx` | 要件、必要書類、出典、下書き支援、出力 |
| メッセージ / マイページ | `src/screens/home.jsx` | 行政書士候補、waitlist、通知設定、履歴 |

## データ

- 補助金 fixture: `data/fixtures/subsidy-programs.json`
- 行政書士候補 fixture: `data/fixtures/expert-partners.json`
- SAMPLE 会社 profile fixture: `data/fixtures/company-profiles/sample-corp.json`
- 合成会社テスト fixture: `data/fixtures/synthetic-companies.mjs`

Fixture は開発用の固定データです。実運用前には公式ページを再確認してください。
合成会社 fixture は `SYNTHETIC_FIXTURE_MODE=1` のテスト実行時だけ使用し、実在企業データとして扱いません。

> **注（公開リポジトリ）**: デモ用の会社（`株式会社サンプル商会 / SAMPLE`、`sample-corp.example`）および行政書士候補（`*.example` ドメイン）はすべて**架空のサンプルデータ**です。実在の企業・事務所とは一切関係ありません。

## 品質ゲート

- Phase 1 必須モジュール: `scripts/score-phase1-modules.mjs`
- 多维 95+ 品質ゲート: `scripts/score-multidim.mjs`
- 法務文案 guard: `scripts/legal-copy-guard.mjs`
- ローカル E2E: `scripts/e2e-local-runner.mjs`
- 合成会社バッチテスト: `tests/synthetic-batch.test.mjs`

GitHub Actions でも同じ `verify:ci` を実行します。
