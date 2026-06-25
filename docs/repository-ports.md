# Repository Ports

Created: 2026-06-20 JST  

## Status

Repository ports define the replaceable persistence boundary needed before `STORE_BACKEND=postgres` can land. The default app still uses `LocalMockStoreRepository`; this PR adds a compatibility adapter instead of rewriting the service layer in one step.

## Port Set

The source of truth is `server/repositoryPorts.mjs`.

| Port | Responsibility |
| --- | --- |
| `UserRepository` | Read beta users. |
| `OrganizationRepository` | Read organizations and memberships visible to the current user. |
| `CompanyRepository` | Read diagnosed company records under user scope. |
| `DiagnosisRepository` | Read diagnosis and match bundles. |
| `SubsidyRepository` | Read subsidy rounds plus ingestion/source traceability. |
| `BusinessPlanRepository` | Read applicant-owned plan records. |
| `ExportedFileRepository` | Resolve export records and cleanup expiry. |
| `LeadRequestRepository` | Persist consent-gated waitlist or expert lead requests. |
| `AuditLogRepository` | Append and read scoped audit events. |

## Migration Path

1. Keep existing services on `LocalMockStoreRepository`.
2. Use `makeLocalRepositoryPorts()` as a compatibility layer for contract tests and adapter development.
3. Implement Postgres repositories behind the same port names in #42.
4. Move service entry points from direct store calls to repository ports one domain at a time.

This avoids a single high-risk rewrite while still making DB replacement a port swap instead of a service rewrite.

## Boundaries

- No production DB adapter is enabled here.
- No production credentials or remote data migration are introduced.
- Expert lead persistence remains waitlist/consent-boundary work; this does not enable marketplace or paid matching.
- No jGrants POST, proxy submission, success-fee, platform take-rate, or production `SubmissionAdapter` is introduced.
