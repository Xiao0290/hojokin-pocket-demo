# etl_pr_plan.md — 補助金ポケット Seed DB v0.1 実装計画

## Milestone D0: Draft-only Import

### PR-D0-01: Add source registry import command
- Objective: `source_registry.json` をDBへ取り込む。
- Files likely touched: `scripts/import-source-registry.ts`, `packages/shared/sourceRegistry.ts`, migrations.
- Acceptance criteria:
  - duplicate `source_id` は upsert
  - `license_status` が unknown/yellow の source は `review_required=true`
  - `npm run data:import:source-registry` が idempotent
- Tests: fixture import / duplicate import / invalid enum rejection.

### PR-D0-02: Add subsidy draft JSONL importer
- Objective: `subsidy_seed_dataset.jsonl` を draft tables にのみ取り込む。
- Acceptance criteria:
  - canonical tables には書き込まない
  - 全recordが `review_status=needs_review`, `publishable=false`
  - required field missing は review task 生成
- Tests:
  - JSONL parse
  - missing official_page_url rejects or creates P0 review task
  - open/upcoming without deadline creates review task

### PR-D0-03: Add review queue CSV importer
- Objective: `review_queue.csv` を source_review_tasks に取り込む。
- Acceptance criteria:
  - task_id idempotent
  - priority / review_reason enum validation
  - source_id foreign key optional but warned

## Milestone D1: Source Review Workspace

### PR-D1-01: Source Inbox page
- Objective: sourceごとの draft 件数・review 件数・license risk を一覧化。
- Acceptance criteria:
  - filter by region / priority / risk / status
  - show stale sources
  - no user-side publish action here

### PR-D1-02: Subsidy Draft Detail page
- Objective: field-level citationを見ながら review できる。
- Acceptance criteria:
  - `program_name`, `round_name`, `deadline`, `max_amount`, `rate`, `target_area`, `required_documents` を編集可能
  - source_quotes と source_urls を表示
  - unknown_fields を review checklist 化

### PR-D1-03: Approve / Reject / Publish workflow
- Objective: draft → approved → published 状態機械。
- Acceptance criteria:
  - published only after all P0 tasks closed
  - audit log writes `source_review.approved` and `source_review.published`
  - user-side matching reads only published rounds

## Milestone D2: Freshness / Change Detection

### PR-D2-01: Add content_hash and field diff
- Objective: source content change を review queue に流す。
- Acceptance criteria:
  - application_end / max_amount_yen / subsidy_rate / target_area change triggers P0 task
  - PDF URL/hash change triggers review
  - closed/open recalculation by current date

### PR-D2-02: Source fetch adapters v0
- Objective: official HTML fetcher + jGrants placeholder adapter.
- Acceptance criteria:
  - robots/terms notes stored
  - raw storage optional and controlled by license flag
  - no jGrants POST or private login assumptions

## Milestone D3: Closed Beta Data Gate

### PR-D3-01: Data quality gate
- Objective: publish対象のquality gate。
- Acceptance criteria:
  - open/upcoming record must have `application_end` or `deadline_text_original` + review note
  - `max_amount_yen` and `subsidy_rate` require citation or explicit unknown
  - `electronic_application` requires citation
  - `license_status=red` cannot publish

### PR-D3-02: Osaka/Kansai beta pack
- Objective: reviewed P0 Kansai records を closed beta 用に publish。
- Acceptance criteria:
  - at least 15 reviewed Kansai records
  - no hard-rule critical unknowns
  - all source URLs valid at review time
