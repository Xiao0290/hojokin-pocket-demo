# 補助金ポケット Seed DB v0.1（closed-beta draft pack）

作成日: 2026-06-20 JST  
対象: Phase 1 / Phase 1.5 の local DB・source-review workspace 用

## 重要な前提

このパックは「ユーザー端にそのまま publish する canonical DB」ではありません。  
全レコードは `review_required=true`, `review_status=needs_review`, `publishable=false` です。

用途:

- source_registry 初期投入
- draft import
- admin source-review workspace の初期テスト
- closed beta 前の P0 seed review
- matching / hard-rule / plan-template の開発検証

非用途:

- 未reviewのままユーザー端 matching に利用
- 採択率予測
- 代理申請・提出自動化
- 成功報酬 marketplace の根拠

## 含まれるファイル

- `source_registry.json` — 22 source items
- `subsidy_seed_dataset.jsonl` — 33 subsidy round records
- `subsidy_seed_dataset_pretty.json` — JSONL の pretty 版
- `human_review_import.csv` — admin review UI に投入しやすいCSV
- `review_queue.csv` — 84 review tasks
- `license_matrix.csv` — sourceごとの利用・再配布リスク
- `eligibility_rule_samples.json` — hard_rules / soft_rules / questions_for_applicant サンプル
- `etl_pr_plan.md` — Codex向け実装PR計画
- `manifest.json` — ファイルハッシュと件数

## 推奨DB投入方針

1. `source_registry.json` を `source_registry` に import。
2. `subsidy_seed_dataset.jsonl` は `subsidy_program_drafts` / `subsidy_round_drafts` にだけ import。
3. `review_queue.csv` を `source_review_tasks` に import。
4. admin が field-level citation を確認。
5. `approved` になった record だけ `subsidy_programs` / `subsidy_rounds` に publish。

## Closed beta 最小条件

- `status=open/upcoming` の全レコードに `application_end` または deadline_text の review 完了
- `max_amount_yen` と `subsidy_rate` に source citation がある
- `electronic_application` の誤判定がない
- multi-round / multi-cap 制度が round 分割済み
- license risk が red でない

