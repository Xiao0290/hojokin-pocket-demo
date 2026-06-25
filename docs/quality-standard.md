# 補助金ポケット Phase 1 必須モジュール品質基準

## 目的

この基準は Phase 1 MVP の必須モジュールを 10 点満点で固定評価するためのものです。対象は「補助金の発見から、申請者本人による事業計画書下書き支援まで」です。

自動採点は `scripts/score-phase1-modules.mjs` で実行します。採点はローカルのソースコード、fixture、テスト、検証スクリプトを読み取り、外部 API や外部 npm package に依存しません。

## 合格ゲート

- 必須モジュールは F01 から F13 までの全 13 件です。
- 各モジュールは 10 点満点です。
- 各モジュールの最低門槛は 8.5 点です。
- 1 件でも 8.5 点未満のモジュールがある場合、採点スクリプトは非 0 で終了します。
- 全体平均は参考値です。全体平均が 8.5 以上でも、個別モジュールが 8.5 未満なら不合格です。

## 多维 95+ ゲート

Phase 1 の機能点が 8.5/10 を満たしていても、運用可能な品質とはみなしません。継続開発では `scripts/score-multidim.mjs` も必須 gate とします。

- 多维評価は D01 から D10 までの 10 件です。
- 各维度は 100 点満点です。
- 各维度の最低門槛は 95 点です。
- 1 件でも 95 点未満の维度がある場合、採点スクリプトは非 0 で終了します。
- 評価対象は、核心流程、安全境界、法務文案、データ provenance、matching、行政書士候補、export、信頼性、検証深度、GitHub CI です。
- ローカルと GitHub Actions は同じ `npm run verify:ci` を実行します。

## 採点方式

- 各項目は原則として、証拠が確認できれば満点、確認できなければ 0 点です。
- 部分点が必要な観点は、最初から複数の小項目に分けます。
- 証拠は「実装コード」「fixture」「テスト」「E2E スクリプト」「品質文書」の順で重視します。
- README など古いデモ説明は、Phase 1 の品質ゲート証拠には使いません。
- `data/runtime` と `data/exports` は実行生成物のため、採点対象外です。

## 必須モジュール一覧

| ID | モジュール | Phase 1 必須内容 |
|---|---|---|
| F01 | ログイン | Email / Google / LINE の入口と、ローカル開発用 mock auth |
| F02 | URL 診断 | 会社 URL を受け取り、診断 job を作り、SSE と polling で進捗確認 |
| F03 | 会社画像 | 会社名、所在地、業種、事業概要、投資方向、引用元、不明点の抽出 |
| F04 | 補助金制度 master | jGrants read-only 相当の fixture と手工 seed、出典と最終確認日の保持 |
| F05 | マッチングエンジン | キーワード粗筛、hard rule、soft score、eligible 候補の順位付け |
| F06 | 診断結果リスト | 3 から 5 件の候補、上限、補助率、締切、理由、warning、出典の表示 |
| F07 | 補助金詳細 | 要件、必要書類、流程 checklist、出典、last_seen_at、公式確認導線 |
| F08 | AI 事業計画書下書き支援 | 章単位生成、本人編集、状態管理、保存、version/revision |
| F09 | エクスポート | docx / PDF 出力と免責文 footer |
| F10 | 通知 | 診断完了や締切 reminder の push / email 設定 |
| F11 | マイページ | 診断履歴、保存済み計画書、会社画像編集導線、通知設定 |
| F12 | 専門家推薦と相談 waitlist | 公式サイトで確認した行政書士候補を制度・会社情報で推薦し、相談希望 lead を記録する。決済、契約成立、代理手続きはしない |
| F13 | 監査ログ | 閲覧、生成、編集、出力、waitlist、通知などの主要行動記録 |

## モジュール別评分项

### F01 ログイン

| 項目 | 点数 | 必要な証拠 |
|---|---:|---|
| mock auth service と dev login route がある | 2.0 | `devLogin` service と `/v1/auth/dev-login` route |
| ローカル user / token を返す | 2.0 | seed user と token response |
| UI に開発ログイン、Email、Google、LINE の入口がある | 2.0 | login screen buttons |
| ログインが audit に記録される | 1.5 | `auth.login` audit event |
| E2E が dev-login を検証する | 2.5 | `scripts/e2e-phase1-mvp.mjs` |
| 合計 | 10.0 |  |

### F02 URL 診断

| 項目 | 点数 | 必要な証拠 |
|---|---:|---|
| URL 正規化と危険 URL 拒否がある | 2.0 | scheme、localhost、private IP、長さ制限 |
| diagnosis job の作成と状態保存がある | 2.0 | `createDiagnosis`、status、progress、events |
| SSE と polling fallback の両方がある | 2.0 | API route、frontend、E2E |
| ローカル fallback fixture がある | 1.5 | SAMPLE cached site fixture |
| URL / SSRF / E2E の自動テストがある | 2.5 | unit test と E2E script |
| 合計 | 10.0 |  |

### F03 会社画像

| 項目 | 点数 | 必要な証拠 |
|---|---:|---|
| 会社名、概要、キーワード、不明点、引用元を抽出する | 2.0 | extraction code |
| 公式サイト由来の会社 fixture がある | 2.0 | company profile fixture |
| diagnosis / matches から会社画像を返す | 2.0 | service response |
| UI が概要、キーワード、不明点を表示する | 1.5 | result card |
| 自動テストが会社名と引用元を検証する | 2.5 | service test |
| 合計 | 10.0 |  |

### F04 補助金制度 master

| 項目 | 点数 | 必要な証拠 |
|---|---:|---|
| seed master に出典、最終確認日、要件、必要書類がある | 2.5 | `subsidyRounds` |
| fixture に hardRules、softRules、requiredDocuments がある | 2.5 | `data/fixtures/subsidy-programs.json` |
| ingestion / source record の追跡がある | 2.0 | store source records |
| round detail API がある | 1.5 | `/v1/subsidies/rounds/{id}` |
| E2E が detail の要件と書類を検証する | 1.5 | E2E detail step |
| 合計 | 10.0 |  |

### F05 マッチングエンジン

| 項目 | 点数 | 必要な証拠 |
|---|---:|---|
| 会社画像と制度キーワードで粗筛する | 2.0 | keyword overlap |
| hard requirement / eligible filtering がある | 2.0 | requirements と eligible filter |
| soft score で順位付けし 5 件以内に絞る | 2.0 | score、sort、slice |
| 理由、warning、締切残日数を返す | 1.5 | match response |
| テストが不適格混入なしと候補数を検証する | 2.5 | unit / E2E |
| 合計 | 10.0 |  |

### F06 診断結果リスト

| 項目 | 点数 | 必要な証拠 |
|---|---:|---|
| matches API と summary がある | 2.0 | `/matches` response |
| 3 から 5 件の候補を返す | 2.0 | slice と tests |
| 上限、補助率、残日数、理由、warning を表示する | 2.0 | result UI |
| 空状態とエラー状態がある | 1.0 | result UI |
| E2E / unit が結果リストを検証する | 3.0 | tests and E2E |
| 合計 | 10.0 |  |

### F07 補助金詳細

| 項目 | 点数 | 必要な証拠 |
|---|---:|---|
| detail API が round data を返す | 2.0 | `getRound` route |
| 要件、必要書類、steps、出典、lastSeenAt がある | 2.0 | master data |
| UI が要件、必要書類、出典を表示する | 2.0 | detail screen |
| 公式サイト確認導線に限定している | 1.5 | safe copy and steps |
| E2E が detail を検証する | 2.5 | E2E detail step |
| 合計 | 10.0 |  |

### F08 AI 事業計画書下書き支援

| 項目 | 点数 | 必要な証拠 |
|---|---:|---|
| business plan 作成 API がある | 1.5 | route and service |
| 章単位の下書きと状態を生成する | 2.0 | sections、status、sources |
| SSE と polling fallback がある | 1.5 | plan events and E2E |
| 章ごとの本人編集と保存がある | 1.5 | PATCH section |
| UI が streaming、textarea、保存、状態 badge を持つ | 1.5 | plan screen |
| 自動テストが作成、編集、保存を検証する | 2.0 | service test and E2E |
| 合計 | 10.0 |  |

### F09 エクスポート

| 項目 | 点数 | 必要な証拠 |
|---|---:|---|
| docx / PDF の export API がある | 2.0 | export route |
| docx と PDF のファイルを生成する | 2.0 | local file builders |
| 免責文を本文または footer 相当へ含める | 2.5 | disclaimer flag and text |
| UI に docx / PDF 出力導線がある | 1.0 | plan screen |
| 自動テストが形式と免責文を検証する | 2.5 | service test and E2E |
| 合計 | 10.0 |  |

### F10 通知

| 項目 | 点数 | 必要な証拠 |
|---|---:|---|
| notification settings API がある | 2.5 | PUT route and service |
| default settings がある | 2.0 | store initial state |
| UI で push / email / deadline を保存できる | 2.0 | MyPage toggles |
| E2E が設定保存を検証する | 2.0 | E2E notification step |
| audit event がある | 1.5 | `notification.setting_changed` |
| 合計 | 10.0 |  |

### F11 マイページ

| 項目 | 点数 | 必要な証拠 |
|---|---:|---|
| `/v1/me` と履歴 API がある | 2.5 | routes |
| UI が user、会社 URL、所在地、候補数を表示する | 2.5 | MyPage |
| 診断、計画書、lead、export、通知設定を返す | 2.0 | `listUserData` |
| tab navigation に MyPage と申請準備がある | 1.5 | app tabs |
| テスト計画に履歴復帰確認がある | 1.5 | test plan |
| 合計 | 10.0 |  |

### F12 専門家推薦と相談 waitlist

| 項目 | 点数 | 必要な証拠 |
|---|---:|---|
| 公式サイト由来の行政書士候補 fixture がある | 2.0 | `data/fixtures/expert-partners.json` |
| 制度・会社情報に基づく推薦 API と score がある | 2.0 | `/v1/experts/recommendations`、`recommendExperts`、`scoreExpert` |
| UI が候補名、適合点、理由、相談希望導線を表示する | 2.0 | Detail / Message screen |
| E2E が推薦取得と expertId 付き waitlist を検証する | 2.0 | E2E recommendations + waitlist step |
| 決済、契約成立、代理手続きを持たず、audit event がある | 2.0 | source scan、`expert_waitlist.submitted` |
| 合計 | 10.0 |  |

### F13 監査ログ

| 項目 | 点数 | 必要な証拠 |
|---|---:|---|
| audit log schema と append helper がある | 2.0 | store and helper |
| 主要イベントが記録される | 2.5 | diagnosis、plan、export、waitlist、notification |
| analytics endpoint が event counts と events を返す | 2.0 | analytics route and service |
| 自動テストが主要 KPI event を検証する | 2.0 | service test and E2E |
| source / ingestion trace がある | 1.5 | ingestion runs and source records |
| 合計 | 10.0 |  |

## 自動採点結果の契約

採点スクリプトは標準出力に以下を出します。

1. 人間が読めるサマリ。
2. `JSON_RESULT_START` 以降の JSON。

JSON には少なくとも以下を含めます。

- `threshold`
- `passed`
- `averageScore`
- `modules[].id`
- `modules[].name`
- `modules[].score`
- `modules[].passed`
- `modules[].items[].label`
- `modules[].items[].weight`
- `modules[].items[].passed`
- `failedModules`

CI やローカル gate は `passed=false` またはプロセス終了コード非 0 を失敗として扱います。
