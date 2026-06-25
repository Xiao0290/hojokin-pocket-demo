# Data Contract

This contract describes the local development fixtures under `data/fixtures/**`. These files support Phase 1 matching and proposal explanations only. They are not realtime subsidy data, legal advice, or an eligibility decision.

Last reviewed: 2026-06-20 JST.

## Subsidy Program Fixture

File: `data/fixtures/subsidy-programs.json`

Every `programs[]` item must include:

| Field | Type | Required | Contract |
| --- | --- | --- | --- |
| `id` | string | yes | Stable fixture id. |
| `program` | string | yes | Reader-facing program name. |
| `round` | string | yes | Reader-facing round/frame label. |
| `sourceUrl` | URL string | yes | Primary official source page for user-facing source links and first re-check. |
| `lastSeenAt` | `YYYY-MM-DD` | yes | Last fixture review date in JST. |
| `status` | string | yes | Local display state such as `open`, `announced_not_open`, `announced_acceptance_pending`, or `closed_waiting_results`. |
| `acceptStart` | date evidence object | yes | Application start. `value` may be `null` if only a period is officially published. |
| `acceptEnd` | date evidence object | yes | Application deadline. `value` may be `null` if only a period is officially published. |
| `maxLimit` | amount summary object | yes | Official or clearly caveated maximum subsidy amount summary. |
| `subsidyRate` | rate summary object | yes | Official or clearly caveated subsidy rate summary. |
| `requirements` | string array | yes | Plain-language requirements for matching and explanation drafts. |
| `requiredDocuments` | string array | yes | Plain-language documents or preparation items. |
| `keywords` | string array | yes | Business and intent keywords used by local matching. |
| `evidence` | evidence object array | yes | Official pages/PDFs that support the fields in the fixture. |
| `sourceNotes` | string array | yes | Source caveats, production re-check notes, or aggregation warnings. |
| `sourceRecord` | source refresh metadata object | yes | Dry-run metadata used for source hash, freshness, registry/license gate, and manual-vs-automated status. |

`acceptStart` and `acceptEnd` use:

```json
{
  "value": "2026-07-21T17:00:00+09:00",
  "display": "2026年7月21日（火）17:00",
  "certainty": "official"
}
```

Use `value: null` when the official source only gives a period such as `2026年7月下旬（予定）`. The `display` field should preserve that official ambiguity, and `certainty` should make it explicit with values such as `official_period_only`, `official_month_only`, or `official_planned`.

`maxLimit` uses:

```json
{
  "amountYen": 4500000,
  "display": "通常枠は5万円以上450万円以下。",
  "certainty": "official"
}
```

If `amountYen` combines multiple official conditions, state that in `display`, set a caveated `certainty`, and add a `sourceNotes[]` warning.

`evidence[]` uses:

```json
{
  "label": "Official normal-frame applicant page",
  "url": "https://example.test/",
  "sourceType": "official_program_page",
  "observedAt": "2026-06-20",
  "supports": ["sourceUrl", "status", "acceptEnd"],
  "note": "Short explanation of what this source supports."
}
```

Evidence rules:

- Use official government, secretariat, or official program pages/PDFs.
- `supports[]` must name actual fixture fields.
- `note` should explain the source role, not paste long source text.
- If a record aggregates multiple frames, mark that in `sourceNotes[]` and split it before production use.

`sourceRecord` uses:

```json
{
  "registrySourceId": "official-subsidy-secretariats",
  "sourceUrl": "https://example.test/",
  "termsUrl": "https://example.test/",
  "licenseStatus": "restricted",
  "commercialUse": "restricted",
  "redistribution": "restricted",
  "automationMode": "manual",
  "contentHash": "sha256...",
  "staleAfterDays": 14,
  "attribution": "Source owner, URL, fetched date, and official-site-control caveat.",
  "transformation": "Development fixture summary only; no production ETL.",
  "displayCaveat": "公式サイトの最新情報を必ず確認してください。"
}
```

Source refresh rules:

- `contentHash` is computed from official-source-backed fixture fields and is reported by `npm run source:refresh:dry-run` before any data mutation.
- `automationMode: manual` means a human checked the official source and updated the fixture metadata. It does not authorize production ETL.
- `automationMode: automated` must not be used unless `docs/source-license-registry.md` allows that exact source and use case.
- `blocked` and `unresolved` registry statuses cannot feed production normalized subsidy cards. `restricted` sources need a source-specific plan before production ingestion.
- Dry-run artifacts must include `sourceUrl`, `lastSeenAt`, `contentHash`, normalized status, staleness, evidence support, and the license gate result.

## Company Profile Fixture

File: `data/fixtures/company-profiles/sample-corp.json`

The company profile must include:

| Field | Type | Required | Contract |
| --- | --- | --- | --- |
| `url` | URL string | yes | URL entered or tested in the diagnosis flow. |
| `canonicalUrl` | URL string or null | yes | Canonical URL from official site metadata when available. |
| `sourceUrl` | URL string | yes | Primary official page for the profile. |
| `lastSeenAt` | `YYYY-MM-DD` | yes | Last fixture review date in JST. |
| `name` | string | yes | Company name supported by official site evidence. |
| `prefecture` / `city` | string or null | yes | Must remain `null` when not visible in official sources. |
| `businessSummary` | string | yes | Plain-language summary supported by official site metadata or bundle strings. |
| `keywords` | string array | yes | Business-domain keywords used for matching. |
| `unknowns` | string array | yes | Facts not proven by official sources but required for eligibility. |
| `fallback` | object | yes | Why the fixture needed fallback extraction. |
| `evidence` | evidence object array | yes | Official site, cache, headers, or bundle evidence. |
| `sourceNotes` | string array | yes | Non-inference rules and production caveats. |
| `citations` | citation object array | yes | User-facing source references. |

Company-source rules:

- Do not infer address, representative, capital, employee count, or corporate number from third-party records.
- If static HTML only contains a React root, record the fallback source and keep unsupported profile fields as `null`.
- A proposal explanation can use business-domain keywords from this fixture, but eligibility checks still require official corporate and financial documents.

## Synthetic Company Fixtures

File: `data/fixtures/synthetic-companies.mjs`

These records are development-only synthetic websites. They do not represent real companies. Use them to verify that the diagnosis, matching, expert-candidate, plan-draft, and export flows work across multiple business scenarios.

Every `syntheticCompanyScenarios[]` item must include:

| Field | Type | Required | Contract |
| --- | --- | --- | --- |
| `id` | string | yes | Stable synthetic scenario id. |
| `fixtureType` | string | yes | Must be `synthetic-development-company`. |
| `url` | URL string | yes | Synthetic website URL used by local tests. |
| `profile` | object | yes | Company profile fallback used only when `SYNTHETIC_FIXTURE_MODE=1`. |
| `profile.name` | string | yes | Reader-facing synthetic company name. |
| `profile.businessSummary` | string | yes | Business summary used for local matching. |
| `profile.keywords` | string array | yes | Keywords intended to exercise matching branches. |
| `profile.unknowns` | string array | yes | Fields that still require user confirmation. |
| `html` | string | yes | Synthetic official-site HTML used instead of network fetch. |
| `expected.primaryRoundId` | string | yes | Expected top local fixture round for regression tests. |
| `expected.minMatches` | number | yes | Minimum candidate count expected from the diagnostic flow. |
| `expected.minTopTotal10` | number | yes | Minimum score breakdown total for the top result. |

Synthetic fixture rules:

- Synthetic fixtures must only activate when `SYNTHETIC_FIXTURE_MODE=1`.
- Synthetic fixtures must not be presented as real official company data.
- At least one low-information website must be included to verify warnings and low-confidence behavior.
- Batch tests must cover all synthetic companies for diagnosis, matching, and expert-candidate output.
- Representative samples must also cover plan editing and DOCX/PDF export.

## Validation

Minimum local validation:

```sh
jq empty data/fixtures/subsidy-programs.json data/fixtures/company-profiles/sample-corp.json
node -e 'const fs=require("fs"); const f=JSON.parse(fs.readFileSync("data/fixtures/subsidy-programs.json","utf8")); for (const p of f.programs) { for (const k of ["sourceUrl","lastSeenAt","requirements","requiredDocuments","keywords","status","acceptStart","acceptEnd","maxLimit","subsidyRate","evidence","sourceNotes"]) if (!(k in p)) throw new Error(p.id + " missing " + k); }'
npm run source:refresh:dry-run
npm run test:synthetic
```
