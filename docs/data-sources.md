# Data Sources

This project currently uses static local development fixtures. The files under `data/fixtures/**` are not realtime subsidy data, not legal advice, and not an eligibility decision.

Last fixture review: 2026-06-20.

Field-level expectations are defined in [`docs/data-contract.md`](./data-contract.md).

Phase 2 ingestion is gated by [`docs/source-license-registry.md`](./source-license-registry.md). No external source should be stored, normalized, displayed, or redistributed in production unless its registry status and provenance requirements allow that exact use.

Issue #4 adds a dry-run source refresh baseline only. It validates fixture metadata, reports source hashes and stale-source status, and writes a local artifact. It does not fetch official pages, run production ETL, call jGrants, or mutate fixture content.

Issue #84 adds `hojokin-pocket-seed-db-v0.1` as a Closed Beta P0 draft seed pack. It is a source-review input, not a canonical subsidy database. The importer verifies the pack manifest hashes and writes a local draft store under `data/runtime/seed-draft-store.json`; it does not mutate `data/fixtures/subsidy-programs.json`, `subsidy_programs`, `subsidy_rounds`, or user-side matching data.

## Development Fixtures

| Fixture | Purpose | Status |
| --- | --- | --- |
| `data/fixtures/subsidy-programs.json` | Seed subsidy program cards, matching keywords, rule copy, source evidence, and deadline display data for Phase 1 MVP development. | Development fixture only |
| `data/fixtures/company-profiles/sample-corp.json` | Seed company profile and official-site evidence for `www.sample-corp.example` URL diagnosis flows. | Development fixture only |
| `data/fixtures/company-sites/*` | Raw or semi-raw local site capture files if present. | Development artifact, not authoritative |
| `data/seed-packs/hojokin-pocket-seed-db-v0.1/*` | Closed Beta P0 seed candidates, source registry, license matrix, review queue, and eligibility draft samples. | Draft-only source review input |

## Seed DB v0.1 Draft Import

Run the draft importer with:

```sh
npm run seed:draft:import
```

The command writes `data/runtime/seed-draft-store.json` and reports:

- 33 subsidy round drafts and 22 source registry items.
- 84 source review tasks and 22 license review rows.
- 9 eligibility rule draft samples.
- 0 canonical round writes and 0 publishable records.

Every imported subsidy candidate must remain:

- `reviewRequired: true`
- `reviewStatus: "needs_review"`
- `publishable: false`

The intended path is:

```text
source_registry.json -> source_registry draft review
subsidy_seed_dataset.jsonl -> subsidy_program_drafts / subsidy_round_drafts
review_queue.csv -> source_review_tasks
license_matrix.csv -> source_license_reviews
eligibility_rule_samples.json -> eligibility_rule_drafts
admin review approved records -> canonical subsidy_programs / subsidy_rounds
```

Do not import `subsidy_seed_dataset.jsonl` directly into canonical subsidy tables, and do not expose these records in user-side matching before an admin publish action. Records with missing `application_end`, `max_amount_yen`, `subsidy_rate`, or `license_status` must stay blocked by review tasks.

For local Closed Beta demos only, a reviewer can publish the machine-safe subset into runtime matching data:

```sh
npm run seed:draft:publish:closed-beta -- --reviewer "reviewer-name"
```

This command reads `data/runtime/seed-draft-store.json` when present, or rebuilds it from the committed seed pack, and writes `data/runtime/published-seed-rounds.json`. The app merges that runtime file into user-side matching on server startup. The command remains conservative:

- it requires an explicit `--reviewer`
- it skips records with critical missing fields
- it skips closed rounds
- it keeps adoption rate `null` and never predicts採択率
- it writes runtime-only data and does not mutate canonical database tables
- it keeps source/license provenance and Closed Beta caveats on each published round

Restart the local API after publishing because the active subsidy pool is loaded at server startup.

## Subsidy Program Sources

| Program | Fixture round | Primary source URL | Notes |
| --- | --- | --- | --- |
| 小規模事業者持続化補助金 | 第20回公募 / 一般型・通常枠 | https://official.jizokukanb.com/shinsei | Official secretariat schedule page. The fixture also cites the 第20回 公募要領 PDF for limits, rates, requirements, and required document notes. |
| ものづくり補助金 | 第23次締切 | https://portal.monodukuri-hojo.jp/about.html | Official program portal. The fixture keeps this as a closed round because the 2026-05-08 17:00 deadline is already past. The 23次 公募要領 PDF supports limits, rates, and requirements. |
| IT導入補助金（デジタル化・AI導入補助金2026） | 2026 通常枠 / 3次締切分 | https://it-shien.smrj.go.jp/applicant/subsidy/normal/ | Official 2026 site uses `デジタル化・AI導入補助金2026`; the fixture keeps `IT導入補助金` as a familiar alias. The official 通常枠 公募要領 PDF supports application-period and one-application rules. |
| 事業承継・M&A補助金 | 15次公募 | https://shoukei-mahojokin.go.jp/r7h/ | Official 14次以降 program site. The fixture summarizes multiple枠 into one MVP-level record and should be split by枠 before production use. |
| 中小企業省力化投資補助金 | 一般型 第7回公募 | https://shoryokuka.smrj.go.jp/ippan/ | Official program site. The exact 第7回受付開始 and deadline were only published as `2026年7月上旬（予定）` and `2026年7月下旬（予定）` at fixture review time, so both exact date values are `null`. |

## Source Refresh Mode

All current subsidy fixture sources are `manual` refresh sources. They were checked as official pages or official PDFs for development fixtures, but their registry status is `restricted` through `official-subsidy-secretariats` / `official-pdf-guidelines`. That status allows a dry-run metadata baseline, not production ingestion or public redistribution of copied source content.

| Program | Current refresh mode | Registry gate | Future automation candidate | Notes |
| --- | --- | --- | --- | --- |
| 小規模事業者持続化補助金 | `manual` | `official-subsidy-secretariats` / `restricted` | Schedule page hash monitoring may be possible after a restricted-use plan. | 商工会地区 and 商工会議所地区 must be split or clearly routed before production. |
| ものづくり補助金 | `manual` | `official-subsidy-secretariats` / `restricted` | Portal/page hash monitoring may be possible after a restricted-use plan. | Closed rounds can remain reference records, but result/adoption pages need separate privacy review. |
| IT導入補助金（デジタル化・AI導入補助金2026） | `manual` | `official-subsidy-secretariats` / `restricted` | Applicant page hash monitoring may be possible after a restricted-use plan. | Tool/vendor eligibility requires official registered-tool checks outside this fixture. |
| 事業承継・M&A補助金 | `manual` | `official-subsidy-secretariats` / `restricted` | Frame-specific pages may be split and monitored after a restricted-use plan. | Current fixture aggregates multiple frames and must be split before production. |
| 中小企業省力化投資補助金 | `manual` | `official-subsidy-secretariats` / `restricted` | Schedule page hash monitoring is a candidate because exact dates were not published at fixture review time. | Exact deadline reminders must wait for a refreshed official schedule source. |

Potential future automated sources must pass [`docs/source-license-registry.md`](./source-license-registry.md):

- `allowed` sources may be automated only with attribution, content hash, fetched timestamp, provenance, update/deletion handling, and freshness monitoring.
- `restricted` sources need a source-specific implementation plan that states allowed fields, attribution, cache duration, transformation, and excluded content.
- `blocked` and `unresolved` sources remain link-only or manual research sources. jGrants production ingestion remains unresolved and cannot be used for normalized public cards.

## Fixture Evidence Fields

Each subsidy program record now carries:

- `sourceUrl`: primary official page to show users and re-check first.
- `lastSeenAt`: date the fixture was last reviewed, in JST.
- `acceptStart` / `acceptEnd`: objects with `value`, `display`, and `certainty`. Use `value: null` when the official source only gives a month or period.
- `maxLimit` / `subsidyRate`: official summary objects for proposal explanations. Amount/rate details are simplified; official公募要領 takes precedence.
- `requirements`, `requiredDocuments`, `keywords`, `status`: minimum data needed for local matching and explanation copy.
- `evidence[]`: official source pages or PDFs, with which fields each source supports.
- `sourceNotes[]`: caveats that must be shown or considered before production use.
- `sourceRecord`: dry-run metadata for `registrySourceId`, `termsUrl`, `licenseStatus`, `automationMode`, `contentHash`, staleness threshold, attribution, transformation, and display caveat.

Run the source refresh dry-run with:

```sh
npm run source:refresh:dry-run
```

The command writes `tmp/source-refresh-dry-run.json` and reports:

- changed `contentHash` before mutation
- normalized `open` / `closed` / `announced` source states
- stale-source warnings from `lastSeenAt`
- `sourceUrl`, `lastSeenAt`, `contentHash`, and evidence-supported fields
- license gate result from the registry rules

## Company Profile Source

| Company URL | Source | Fixture handling |
| --- | --- | --- |
| https://www.sample-corp.example/ja/ | Official website HTML metadata, cached headers, and the public JavaScript bundle referenced by that page. | The HTML body is React-rendered and only exposes a root element. The profile falls back to meta description and bundle strings. Prefecture and city are intentionally `null` because the official page did not expose address data in the fetched content. |

Local cache files used for the company profile:

- `data/fixtures/company-sites/sample-corp.html`
- `data/fixtures/company-sites/sample-corp-root.html`
- `data/fixtures/company-sites/sample-corp.headers.txt`
- `data/fixtures/company-sites/sample-corp-root.headers.txt`

## Use Boundaries

- Do not present these fixtures as live application deadlines.
- Re-check official pages before any production diagnosis, customer-facing recommendation, or application workflow.
- `hardRules` are meant to block obviously unsafe matches in the MVP UI.
- `softRules` are prompts for ranking, explanation, or follow-up questions; they are not definitive eligibility criteria.
- Amounts and rates are simplified into MVP-friendly summaries. Official公募要領 always takes precedence.
- The company fixture may explain business domains such as 宿泊運営, AI業務自動化, 日中貿易, 金属加工, and 3Dプリント試作, but it must not infer所在地, 従業員数, 資本金, 代表者, or法人番号 from third-party records.
