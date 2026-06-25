# Source License And Provenance Registry

Created: 2026-06-20 JST  
Purpose: gate Phase 2 source ingestion before any external subsidy data is stored, transformed, displayed, or redistributed.

This registry is product/data governance, not legal advice. When a source is unclear, the status is `unresolved` or `blocked` until the source owner, published terms, or counsel confirms reuse.

## Status Model

| Status | Meaning | Product rule |
| --- | --- | --- |
| `allowed` | Terms clearly allow the planned commercial storage, transformation, display, and redistribution with stated conditions. | ETL may proceed if attribution, freshness, and provenance fields are implemented. |
| `restricted` | Some use is allowed, but scope, attribution, transformation, or redistribution has limits. | ETL may proceed only for the allowed use case and must enforce the listed restrictions. |
| `blocked` | Terms prohibit the planned use or require consent that has not been received. | Do not ingest, cache, transform, or display copied content. Link-only is acceptable when normal linking is allowed. |
| `unresolved` | The source is official or useful, but the license/terms do not clearly authorize the planned use. | No production ETL or public normalized display. Use only for manual research or fixture notes until resolved. |

## Required Registry Fields

Every production source must have:

- `source_id`: stable id used by ETL and `sourceRecords`.
- `owner`: government body, secretariat, agency, or publisher.
- `source_url`: canonical source or API URL.
- `terms_url`: license, terms, site policy, or unresolved marker.
- `status`: `allowed`, `restricted`, `blocked`, or `unresolved`.
- `commercial_use`: `allowed`, `restricted`, `blocked`, or `unresolved`.
- `redistribution`: `allowed`, `restricted`, `blocked`, or `unresolved`.
- `attribution`: exact credit/source wording or minimum fields.
- `freshness_expectation`: expected re-check cadence.
- `provenance_required`: fields to store in `sourceRecords` and UI.
- `unresolved_questions`: specific questions blocking wider use.
- `last_checked_at`: JST date.

Recommended `sourceRecords` extension for Phase 2:

```json
{
  "id": "source_jgrants_public_api_20260620_abc123",
  "source": "jgrants_public_api",
  "registrySourceId": "jgrants-public-api",
  "externalId": "subsidy-or-round-id",
  "sourceUrl": "https://...",
  "termsUrl": "https://...",
  "licenseStatus": "unresolved",
  "commercialUse": "unresolved",
  "redistribution": "unresolved",
  "attribution": "Source name and URL shown to users",
  "contentHash": "sha256...",
  "rawRef": "s3://immutable-raw-source/...",
  "fetchedAt": "2026-06-20T00:00:00+09:00",
  "lastSeenAt": "2026-06-20",
  "transformation": "normalized fields only; no official endorsement implied",
  "displayCaveat": "Always confirm on the official site."
}
```

## Candidate Source Registry

Access date for URLs: 2026-06-20.

| source_id | Candidate source | owner | source_url | terms_url | status | commercial_use | redistribution | attribution | freshness_expectation | provenance_required | unresolved_questions |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `jgrants-public-api` | Jグランツ public subsidy API | デジタル庁 / Jグランツ | https://developers.digital.go.jp/documents/jgrants/api/ | API terms not clearly surfaced from the API docs; Jグランツ service terms: https://www.jgrants-portal.go.jp/stipulation | `unresolved` | `unresolved` | `unresolved` | At minimum: "Jグランツ公開API / デジタル庁", source URL, fetched date, and "official site controls" caveat. | Daily for open rounds; weekly for closed/reference records. | API endpoint, request params, raw response hash, fetchedAt, lastSeenAt, source detail URL, field mapping, transformation note. | Does API terms permit commercial normalized display and redistribution? Are cached historical records allowed after source deletion/change? Is attribution wording prescribed? |
| `jgrants-open-data-consent` | Jグランツ open-data consent materials | デジタル庁 / Jグランツ | https://fs2.jgrants-portal.go.jp/%E3%82%AA%E3%83%BC%E3%83%97%E3%83%B3%E3%83%87%E3%83%BC%E3%82%BF%E5%8C%96%E3%81%AE%E5%90%8C%E6%84%8F%E3%81%AB%E3%81%A4%E3%81%84%E3%81%A6.pdf | same | `unresolved` | `unresolved` | `unresolved` | Same as Jグランツ; do not imply all Jグランツ records are open data. | Re-check before each ingestion release. | Consent document version, target fields, linked policy, source owner. | Which exact Jグランツ fields are covered by open-data consent, and where is the machine-readable license for each field? |
| `gbizinfo-open-data` | gBizINFO open data exposed from Jグランツ-linked fields | 経済産業省 / デジタル庁 ecosystem | https://info.gbiz.go.jp/ | Terms/license must be checked per API/dataset before use. | `unresolved` | `unresolved` | `unresolved` | Source name, URL, fetched date, transformation note. | Daily to weekly depending on field. | API URL, raw response hash, corporate/subsidy ids, fetchedAt, field mapping. | Can subsidy fields derived from Jグランツ be reused commercially? What deletion/update obligations apply? |
| `mirasapo-plus` | ミラサポplus articles/tools | 中小企業庁 / ミラサポplus運営 | https://mirasapo-plus.go.jp/ | https://mirasapo-plus.go.jp/about/terms/ | `restricted` | `restricted` | `restricted` | Link and cite ミラサポplus page title/URL/date; do not copy article bodies unless terms permit. | Manual re-check before release; monthly if linked as reference. | URL, title, fetchedAt, contentHash if cached, copied fields if any. | Which specific sections can be cached or transformed, and are third-party copyrights embedded? |
| `j-net21` | J-Net21 subsidy/business articles | 中小企業基盤整備機構 | https://j-net21.smrj.go.jp/ | https://j-net21.smrj.go.jp/rule/ | `blocked` | `blocked` for copied reuse without prior consent | `blocked` without prior consent | Link-only with page title/URL/date unless consent is received. | Manual link re-check only. | URL and last checked date for outbound link records; no copied body. | Is written consent available for target pages? Are database entries separately licensed? |
| `local-open-data-pdl` | Local-government open data using Public Data License 1.0 or compatible terms | Local governments / デジタル庁 open-data program | https://www.digital.go.jp/resources/open_data/public_data_license_v1.0 | Dataset-specific terms plus PDL1.0 | `allowed` when dataset applies PDL1.0 and no exception is listed | `allowed` with PDL1.0 conditions | `allowed` with PDL1.0 conditions | Source organization, dataset name, URL, license name, version, fetched date, modification note. | Daily to monthly by dataset update frequency. | Dataset metadata, license URL, contentHash, fetchedAt, lastSeenAt, transformed fields, exception list. | Does each municipality actually apply PDL1.0 to the subsidy dataset? Are logos/photos/third-party content excluded? |
| `local-open-data-unknown` | Local-government pages without explicit open-data license | Local governments | Per municipality/program page | Per page/site policy | `unresolved` | `unresolved` | `unresolved` | Link-only until terms are confirmed. | Manual re-check. | URL, title, fetchedAt, observed terms page. | Does site policy permit commercial reuse, caching, and transformed display? |
| `imi-vocabularies` | IMI common vocabularies / schema references | デジタル庁 / IMI | https://imi.go.jp/imi | IMI site terms/license must be checked for each artifact. | `restricted` | `restricted` | `restricted` | Cite IMI vocabulary name/version/URL/date; preserve schema provenance. | Re-check when vocabulary version changes. | Vocabulary URL, version, fetchedAt, transformation mapping. | Which IMI artifacts are under which license, and does the project need to include license text? |
| `mhlw-employment-subsidy-pages` | MHLW employment subsidy search and pages | 厚生労働省 | https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/koyou/kyufukin/index_00007.html | https://www.mhlw.go.jp/chosakuken/index.html | `restricted` | `restricted` under MHLW terms and listed exceptions | `restricted` under MHLW terms and listed exceptions | Source: 厚生労働省, page title/URL, fetched date, modification note. | Daily/weekly during active rounds; monthly for static guidance. | URL, page title, contentHash, fetchedAt, lastSeenAt, copied fields, exception check. | Do embedded PDFs/forms contain third-party materials? Are employment grants routed to 社労士 domain in product logic? |
| `mhlw-esop` | Employment subsidy portal / e-Gov-style related portal | 厚生労働省 | https://www.esop.mhlw.go.jp/ | Site-specific terms plus MHLW terms if incorporated. | `unresolved` | `unresolved` | `unresolved` | Link-only until site-specific terms are confirmed. | Manual re-check before any integration. | URL, page title, fetchedAt, terms URL. | Are portal search results reusable? Is automated access allowed? |
| `official-subsidy-secretariats` | Official subsidy offices and secretariat pages/PDFs | Program secretariats / ministries / contractors | Example: https://official.jizokukanb.com/shinsei, https://portal.monodukuri-hojo.jp/, https://it-shien.smrj.go.jp/, https://shoryokuka.smrj.go.jp/ | Per site/page/PDF terms | `restricted` | `restricted` | `restricted` | Program name, secretariat, source page/PDF URL, fetched date, modification note, official-site-control caveat. | Daily during application windows; daily near deadlines; weekly otherwise. | URL, PDF/page title, contentHash, fetchedAt, lastSeenAt, field supports, extracted page/section, transformation note. | Does each secretariat permit caching and normalized display? Are forms/guides copyrighted separately? |
| `official-pdf-guidelines` | Publicly posted program PDFs, 公募要領, manuals, application guides | Program secretariats / ministries / contractors | Per PDF URL | Per site/PDF terms | `restricted` | `restricted` | `restricted` | Source PDF title, URL, publication/update date if visible, fetched date, extracted page/section, modification note. | Re-check hash daily/weekly depending on active round. | Raw immutable PDF ref, contentHash, page number, extracted fields, extraction method, human review status. | Are full-text snippets displayable? Are tables/forms protected separately? |
| `adoption-result-pages` | Official adoption/grant decision result pages | Program secretariats / ministries | Examples: https://portal.monodukuri-hojo.jp/saitaku.html, https://jigyou-saikouchiku.go.jp/result.html, https://it-shien.smrj.go.jp/download/grantdecision_list/ | Per site/page terms | `restricted` | `restricted` | `restricted` | Program, round, result page URL, fetched date, "aggregate historical statistic" label. | Re-check after each result announcement; keep historical hash. | URL, round id, application count, adoption/grant-decision count, PDF/list hash, fetchedAt. | Can named adoptee lists be republished? Are personal/sole proprietor names present? |
| `company-official-sites` | User-provided company official sites | Company / website owner | User-entered URL | Site-specific terms / robots / consent | `restricted` | `restricted` to user-requested diagnosis and limited cache | `blocked` for public redistribution | Show only applicant-facing extracted summary with citation; do not republish raw content. | Per diagnosis; cache expiry required. | URL, canonical URL, fetchedAt, contentHash, robots/headers, extracted fields, user attestation. | What cache retention and deletion rights apply? Is the user authorized to submit the site for diagnosis? |

## Ingestion Gates

1. `blocked` sources must not be ingested, cached, transformed, displayed, or redistributed. Store outbound link metadata only.
2. `unresolved` sources may be used for manual research and docs, but not for production ETL or public normalized subsidy cards.
3. `restricted` sources need an ingestion plan that lists allowed fields, excluded fields, attribution, cache duration, and deletion/update handling.
4. `allowed` sources still require attribution, source URL, license URL, content hash, fetched timestamp, and source-change monitoring.
5. Any source containing personal names, applicant lists, contact details, bank/payment details, or uploaded user documents needs a separate privacy/security review before storage.
6. PDF extraction must store raw immutable artifact references and extracted field provenance. Full PDF redistribution is not allowed unless the source license explicitly permits it.
7. Product UI must show source name, URL, `lastSeenAt`, and a caveat that the official source controls.
8. No ETL job may run in production unless `registrySourceId` maps to this registry and `licenseStatus` is not `blocked` or `unresolved`.

## Phase 2 ETL Checklist

- [ ] Add `registrySourceId`, `termsUrl`, `licenseStatus`, `commercialUse`, `redistribution`, `attribution`, `transformation`, and `displayCaveat` to production `source_records`.
- [ ] Validate every source id against this registry before fetch.
- [ ] Persist raw artifact refs and hashes for API responses, HTML pages, PDFs, and downloaded attachments.
- [ ] Re-fetch active-round sources on the registry cadence and record `last_seen_at`.
- [ ] Split source extraction from product display so blocked/restricted fields cannot leak to UI.
- [ ] Add a deletion/update path when a source removes a record or changes terms.
- [ ] Add human review status for LLM/PDF-extracted eligibility rules.

## Handoff

- Red lines: do not ingest J-Net21 copied content; do not publish normalized jGrants data until API terms/redistribution are confirmed; do not ingest local-government pages without a license; do not display named adoption lists without privacy review.
- Unconfirmed: jGrants API reuse terms, exact open-data coverage for Jグランツ-derived fields, municipality-by-municipality licenses, IMI artifact license details, secretariat PDF caching/display permissions.
- Product implications: Phase 2 should build registry-aware ETL first. Public subsidy cards must carry source/terms/freshness fields, and unresolved sources stay link-only or research-only.
