# 補助金ポケット Phase 1 MVP テスト計画

## 目的

Phase 1 MVP の受け入れ範囲は「補助金の発見 → 本人による下書き支援」です。テストでは、URL 診断、SSE/ポーリング進捗、候補表示、詳細、事業計画書の生成・編集・docx/PDF 出力、通知設定、専門家 waitlist、analytics 記録を確認します。

Phase 1 では、専門家撮合、チャット、決済、jGrants 自動提出、会社個別の採択率予測は対象外です。

## ローカル前提

- API: `http://127.0.0.1:8787`
- Vite frontend: `http://127.0.0.1:5173`
- テスト会社 URL: `https://www.sample-corp.example`
- 開発用ログイン、mock worker、local deterministic plan generator、seed/fixture がローカルで動くこと

必要に応じて環境変数で上書きします。

```bash
API_BASE_URL=http://127.0.0.1:8787 \
FRONTEND_BASE_URL=http://127.0.0.1:5173 \
node scripts/e2e-phase1-mvp.mjs
```

## 自動検証

### Phase 0 quality behavior gates

実行:

```bash
npm run test:quality-gates
```

検証項目:

- SSRF guard は metadata IP と redirect 後 private IP を拒否する。
- export は未登録ファイルを拒否し、生成済み docx/PDF の免責文を読め、期限切れ export record を拒否する。
- 開発用 auth は `dev-token` / `mock` または `local_mock` audit として扱われ、self-site attestation なしの診断を拒否する。
- 合成会社 fixture は `SYNTHETIC_FIXTURE_MODE=1` のときだけ診断に使われ、通常実行では実在企業データとして扱われない。
- 回帰 fixture は SSRF redirect 再検証、export 期限確認、self-site attestation、合成 fixture mode の各保護を一時的に壊し、該当 gate が非 0 で落ちることを確認する。

### E2E happy path

実行:

```bash
node scripts/e2e-phase1-mvp.mjs
```

検証項目:

- API health と Vite frontend health を待てる。
- `dev-login` で Bearer token を取得できる。`E2E_TOKEN` 指定時はそれを使える。
- `POST /v1/diagnoses` に `https://www.sample-corp.example` を投入し、`diagnosisId` と `companyId` を得る。
- `GET /v1/diagnoses/{id}/events` の SSE で `diagnosis.done` を待つ。SSE が使えない場合は `GET /v1/diagnoses/{id}` polling に fallback する。
- `GET /v1/diagnoses/{id}/matches` は候補を返し、`eligible=false` を混入させない。
- `GET /v1/diagnoses/{id}/matches` は `provenance.matcher = local_keyword_signal_v1`、`directSignalRequired = true`、`fixedRecommendationSet = false` を返す。
- no-signal の実サイト相当 profile は候補 0 件を返し、固定の候補リストを返さない。
- `GET /v1/subsidies/rounds/{roundId}` は要件、必要書類、出典/最終確認日を返す。
- `POST /v1/business-plans` で `planId` を作り、SSE または polling で draft 完了を待つ。
- `GET /v1/business-plans/{id}` は `generation.provider = local_mock`、`mode = deterministic_template`、`model = null`、`llm = false` を返す。
- `PATCH /v1/business-plans/{id}/sections/{chapterNo}` で章を `edited` にできる。
- `POST /v1/business-plans/{id}/export` は `docx` と `pdf` の両方で成功し、`disclaimerIncluded` が false ではない。
- `POST /v1/leads/expert` は waitlist のみを記録する。
- `PUT /v1/me/notifications/settings` で通知設定を保存できる。
- analytics endpoint で `diagnosis.completed`、`business_plan.exported`、`expert_waitlist.submitted`、`notification.setting_changed` を確認できる。

### API / integration

- URL validation は `localhost`、`127.0.0.1`、private IP、metadata IP、2048 文字超を拒否する。
- SSRF block は DNS rebinding と redirect 後 private IP を拒否する。
- diagnosis worker mock は `scraping → extracting → matching → done` を通る。
- matching provenance は matcher、補助金データソース、会社 profile sourceType、direct-signal policy を返す。
- robots disallowed、URL inaccessible、extraction failed、LLM timeout は定義済み error code を返す。
- `GET /matches` は hard requirement 不適格を返さない。
- `daysLeft` は日付境界と JST で正しく計算する。
- adoption rate は source がない場合に数値を表示しない。
- section status は `ai_draft → edited → confirmed/exported` のみ許可する。
- export は footer disclaimer を docx/PDF に含める。
- forbidden copy scanner は「提出する」「代理申請」「採択率予測」など Phase 1 禁止表現を検出する。

## 人工ブラウザ検証

推奨 viewport: mobile 390 x 844。実機またはブラウザ device toolbar で確認します。

- 開発用ログイン後、`診断` Tab に入る。
- desktop / tablet / mobile でアプリが responsive shell として表示され、desktop で固定の疑似 PhoneFrame に閉じ込められていないことを確認する。
- ホームで会社 URL を入力し、診断開始 CTA が明確に動く。
- 診断中画面は spinner だけでなく、3-step の現在状態と完了状態を表示する。
- SSE 断線時は `接続を確認しています...` 相当の状態を出し、polling で復帰する。
- 診断結果は最初に候補数と上限合計を大きく表示し、行政書士相談への導線を先に出す。
- 各候補は制度名、上限、補助率、締切/残日数、適合理由、warning、出典、最終確認日を二次情報として表示する。
- 詳細画面は要件、必要書類、AI 下書き可能な書類、公式ページ導線を表示する。
- 詳細画面は行政書士相談 CTA を主導線にし、条件補足・必要書類・下書き作成は折りたたみ内または後続導線に置く。
- 採択率は制度一般の出典付き数値だけを表示し、会社個別の予測値を出さない。
- 事業計画書は「本人の下書き支援」として表示され、章単位でストリーミング生成される。
- ユーザーが章本文を編集し、保存後も編集済み状態が維持される。
- docx/PDF export は成功し、ファイル内 footer に免責文がある。
- 専門家機能は Coming soon / waitlist のみで、撮合、チャット、決済、委任を開始しない。
- jGrants は公式サイト確認の導線だけで、アプリ内提出 CTA を出さない。
- 通知設定は email/push と deadline reminder の状態を保存・再表示できる。
- マイページまたは診断履歴で最新診断と保存済み計画書に戻れる。
- analytics/admin 画面または DB で主要 KPI イベントが確認できる。

## リリース前ゲート

- `node scripts/e2e-phase1-mvp.mjs` が local mock で成功する。
- API tests、URL/SSRF tests、export disclaimer tests、legal copy guard が成功する。
- mobile ブラウザで happy path を 1 回通し、スクリーンショットを残す。
- Phase 1 禁止範囲が UI と API に露出していないことを確認する。
