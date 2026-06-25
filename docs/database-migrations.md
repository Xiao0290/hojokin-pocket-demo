# Database Migration Foundation

Created: 2026-06-20 JST  

## Status

This is the Closed Beta alpha migration foundation. It defines the first relational schema and validation tooling, but the app still defaults to local JSON storage.

Default runtime:

```sh
STORE_BACKEND=local
```

Postgres runtime is not enabled by default. Issue #42 adds an opt-in adapter behind `STORE_BACKEND=postgres`; local JSON remains the default.

## Commands

```sh
npm run db:validate
npm run db:migrate
npm run db:reset
npm run db:seed
```

`db:validate` is read-only and runs in CI through `npm run verify:ci`.

`db:migrate` and `db:reset` are safe by default. Without `DATABASE_URL`, they validate the migration plan and do not mutate a database. Mutable execution requires a local database URL plus explicit write flags:

```sh
DATABASE_URL=postgres://hojokin:hojokin_local_only@localhost:54329/hojokin_pocket \
ALLOW_DB_MUTATION=1 \
npm run db:migrate
```

Reset also requires `ALLOW_DB_RESET=1`.

`db:seed` is inert in the default local mode and does not mutate a database. With `STORE_BACKEND=postgres`, it seeds the configured local Postgres database with the Closed Beta alpha demo snapshot after migrations have been applied:

```sh
STORE_BACKEND=postgres \
DATABASE_URL=postgres://hojokin:hojokin_local_only@localhost:54329/hojokin_pocket \
ALLOW_DB_MUTATION=1 \
npm run db:seed
```

## Local Postgres

Use Docker only for local development experiments:

```sh
docker compose up -d postgres
DATABASE_URL=postgres://hojokin:hojokin_local_only@localhost:54329/hojokin_pocket npm run db:validate
DATABASE_URL=postgres://hojokin:hojokin_local_only@localhost:54329/hojokin_pocket ALLOW_DB_MUTATION=1 npm run db:migrate
STORE_BACKEND=postgres DATABASE_URL=postgres://hojokin:hojokin_local_only@localhost:54329/hojokin_pocket ALLOW_DB_MUTATION=1 npm run db:seed
```

Do not point these commands at production or customer data.

## Initial Schema

The initial schema covers:

- users
- organizations and memberships
- companies and diagnoses
- subsidy programs, rounds, and matches
- applicant confirmations
- business plans and exported files
- consent records and lead requests
- notification settings
- source registry, source records, extraction runs, field citations, and review decisions
- audit logs

The schema intentionally includes source-review and consent tables early because Closed Beta requires reviewed subsidy data and explicit expert-lead consent before user display or lead handoff.

## Safety Rules

- Local JSON remains the default store.
- No production DB credentials belong in the repo.
- No remote DB mutation is allowed without an explicit future deployment decision.
- No user data migration is performed by this PR.
- No jGrants POST, proxy submission, marketplace, success-fee, or production `SubmissionAdapter` is introduced.
