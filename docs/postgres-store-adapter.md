# Postgres Store Adapter

Created: 2026-06-20 JST  

## Status

`STORE_BACKEND=local` remains the default runtime. `STORE_BACKEND=postgres` is opt-in and requires `DATABASE_URL`; missing configuration fails before the app starts.

The adapter maps the current local store shape to the initial Closed Beta alpha Postgres schema. This keeps the existing service layer and demo path stable while opening the replacement path for managed Postgres or Aurora later.

## Local Commands

```sh
npm run db:validate
DATABASE_URL=postgres://hojokin:hojokin_local_only@localhost:54329/hojokin_pocket ALLOW_DB_MUTATION=1 npm run db:migrate
STORE_BACKEND=postgres DATABASE_URL=postgres://hojokin:hojokin_local_only@localhost:54329/hojokin_pocket ALLOW_DB_MUTATION=1 npm run db:seed
STORE_BACKEND=postgres DATABASE_URL=postgres://hojokin:hojokin_local_only@localhost:54329/hojokin_pocket npm run dev:api
```

`db:seed` only writes when `STORE_BACKEND=postgres`, `DATABASE_URL`, and `ALLOW_DB_MUTATION=1` are all present.

## Boundaries

- No production database credentials are added.
- No remote database mutation is performed.
- No customer data migration is performed.
- No jGrants POST, proxy submission, marketplace, success-fee, platform take-rate, or production `SubmissionAdapter` is introduced.
