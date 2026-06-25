# Production Persistence and Access Boundary

Issue #5 introduces the first production-ready boundary while keeping the local JSON store as the default implementation for CI and development.

## Current Local Implementation

- `LocalMockStoreRepository` remains the default repository.
- Runtime state is stored in `data/runtime/store.json` unless `RUNTIME_DIR` overrides it.
- Export files are stored in `data/exports` unless `EXPORT_DIR` overrides it.
- The local auth adapter returns `usr_dev_owner` and records `auth.login` audit events.
- No AWS, database, or object-storage dependency is required for local tests.

## Repository Boundary

Service code must not rely on unscoped reads for user-owned records. The repository exposes scoped reads for:

- user snapshots for My Page and analytics views;
- diagnosis bundles with the owned company and owned matches;
- plan bundles with the owned company;
- export records under owned plans;
- expired export cleanup across local records.

Raw `load`, `save`, and `mutate` remain available for local implementation tests and migration tooling, but product services should enter user-owned data through the scoped methods.

## Access Boundary

The boundary is owner-only for Phase 2 alpha:

- every company, diagnosis, applicant confirmation, plan, lead, audit log, and export record is associated with the current auth user;
- cross-user reads are returned as not found rather than disclosing that another user's object exists;
- expert-side, payment, filing, and marketplace access modes are intentionally not modeled here;
- future admin or support access must be a separate audited role with explicit tests before it is enabled.

The current local token is still a development token. Production auth should resolve a stable app user id from the verified session before services call the repository.

## Production Target

The conservative production target is:

- Aurora PostgreSQL Serverless v2 for transactional records;
- pgvector for later subsidy/profile retrieval support;
- S3 with server-side encryption for export files and source-cache artifacts;
- short-lived signed download URLs for export files;
- application audit logs in the primary database, with export file events linked by record id.

No live AWS dependency is introduced by this issue. The JSON implementation is the contract-test target until a PostgreSQL implementation exists.

## File Retention and Cleanup

Exports are temporary applicant-facing artifacts:

- generated local export records expire after 15 minutes;
- download routes reject missing or expired records;
- cleanup removes expired records from `plans[].exports` and may remove local files when called with file deletion enabled;
- production S3 objects should use lifecycle expiration no longer than the record retention window unless counsel or user data export requirements require a documented exception;
- exported files must not be used as durable document storage.

## Migration Path

1. Keep `LocalMockStoreRepository` as the CI default and contract baseline.
2. Add a PostgreSQL repository that implements the same scoped methods.
3. Run the same repository contract tests against JSON and PostgreSQL.
4. Move export file writes from local disk to S3 behind the same export record behavior.
5. Replace local mock auth with session-backed user resolution before any multi-user alpha traffic.

## PR Handoff Notes

- Keep issue #5 focused on persistence, owner scoping, and retention.
- Do not add payment, expert-side operational access, or official electronic workflow behavior in this PR.
- Follow-up PRs should add PostgreSQL schema migrations and S3 signed URL adapters behind the existing contracts.
