# Tenant Scope Hardening

Created: 2026-06-20 JST  

## Status

The local MVP has a user-scoped access boundary. This hardening pass expands negative service tests and role-gates the admin source-review endpoint.

## Current Rules

- Normal users can read and mutate only their own diagnoses, matches, plans, exports, leads, and audit-facing data.
- Cross-user identifiers resolve to `404 NOT_FOUND` where possible to avoid confirming another user's record exists.
- `/v1/admin/source-review` requires an AuthContext role of `admin` or `system_admin`.
- The pure `server/adminReview.mjs` builder remains testable without auth because it does not expose an HTTP/service entry point by itself.

## Still Local MVP

- Organization scope exists in the store and AuthContext, but production organization membership enforcement remains future work.
- This does not add production invite, OAuth, Cognito, LINE, Google, or gBizID authentication.
- This does not grant experts direct case access.

## Pause Lines

No marketplace, success-fee, platform take-rate, proxy drafting/submission, jGrants POST, or production `SubmissionAdapter` is introduced.
