# Audit Log Contract

Created: 2026-06-20 JST  

## Status

`server/auditLogContract.mjs` is the source of truth for application audit events.
The local MVP stores audit logs in `LocalMockStoreRepository`, and the opt-in
Postgres adapter maps the same normalized fields. New appends pass through the
same contract normalizer before persistence.

This issue does not add an external observability vendor, production data export,
marketplace behavior, success fees, platform take-rate, proxy drafting/submission,
jGrants POST, or a production `SubmissionAdapter`.

## Record Shape

Every new audit record has:

| Field | Required | Notes |
| --- | --- | --- |
| `id` | yes | Store-generated append id. |
| `schemaVersion` | yes | `audit-log.v1`. |
| `userId` | yes | Actor user id, kept for existing analytics and scoping. |
| `organizationId` | yes, nullable | Reserved for tenant-aware adapters. |
| `actorType` | yes | `user`, `admin`, or `system_admin`. |
| `actor` | yes | `{ type, userId, organizationId, role }`. |
| `event` / `eventType` | yes | Canonical event name. `event` is preserved for current analytics. |
| `targetType` / `targetId` | yes | Flat target fields for DB adapters and analytics. |
| `target` | yes | `{ type, id }`. |
| `payload` | yes | Redacted metadata only. |
| `correlationId` | yes | Generated when the caller does not pass one. |
| `createdAt` | yes | ISO timestamp. |

## Event Names

The closed-beta minimum emitted events are:

| Action | Event |
| --- | --- |
| Diagnosis started | `diagnosis.started` |
| Diagnosis completed | `diagnosis.completed` |
| Diagnosis detail viewed | `diagnosis.viewed` |
| Match result viewed | `match.viewed` |
| Applicant confirmation updated | `confirmation.updated` |
| Business plan generation started | `business_plan.started` |
| Business plan generation completed | `business_plan.completed` |
| Business plan section edited | `business_plan.section_edited` |
| Business plan exported | `business_plan.exported` |
| Expert waitlist submitted | `expert_waitlist.submitted` |
| Export file downloaded | `file.downloaded` |
| Admin source review opened | `admin.source_reviewed` |

Reserved compatible names are also allowed by the contract for future UI or adapter
variants: `diagnosis.created`, `business_plan.generated`,
`lead_request.created`, and `admin.source_viewed`.

Existing non-minimum local MVP events remain allowed so analytics does not regress:
`auth.login`, `expert_recommendations.viewed`, `notification.setting_changed`, and
`submission.blocked`.

## Redaction Rules

Audit payloads must stay useful for product analytics without storing direct
personal/contact/payment identifiers. Payloads should contain IDs, counts, booleans,
statuses, format names, provider metadata, and source-review summary counts.

The contract redacts sensitive key names such as email, phone, contact, address,
full name, payment, card, bank, account, token, secret, password, raw HTML, prompt,
message, memo, and note. Long strings are truncated. Lead/waitlist audit payloads
intentionally omit free-text messages.

## Append-Only Boundary

`AuditLogRepository` exposes only:

- `append`
- `listForUser`

There is no normal-user API or repository port for audit update, patch, delete,
remove, replace, or truncate. Local test fixtures can still reset the whole store;
that is not an application audit mutation capability.

## Admin Source Review

`getAdminSourceReview()` remains role-gated by `AuthContext` (`admin` or
`system_admin`). A successful read appends `admin.source_reviewed` with summary
counts only. Failed non-admin access remains a 403 and does not grant source-review
visibility.

## Postgres Adapter

The opt-in Postgres store adapter maps the normalized fields directly:

- `userId` -> `user_id`
- `organizationId` -> `organization_id`
- `actorType` -> `actor_type`
- `eventType` or `event` -> `event`
- `targetType` -> `target_type`
- `targetId` -> `target_id`
- redacted `payload` -> `payload_json`
- `correlationId` -> `correlation_id`
- `createdAt` -> `created_at`

The adapter rejects unsupported event names by reusing `server/auditLogContract.mjs`
rather than accepting free-form strings.
