# Auth Boundary Runbook

Date: 2026-06-20 JST  
Gate: `v0.2-alpha-foundation`

## Purpose

This runbook keeps the Closed Beta auth boundary clear while the app still uses
local mock auth by default. The product may demo locally, but production-like
environments must fail closed unless a real auth provider is injected.

## Current Boundary

- `AuthContext` carries `userId`, `organizationId`, `role`, provider, token type,
  and `accessScope`.
- Development and test may use `dev-token`.
- `APP_ENV` or `NODE_ENV` values of `production`, `staging`, `beta`, or
  `closed-beta` reject local mock auth and dev tokens.
- Product services use `currentAccessScope()` before reading diagnoses, plans,
  exports, leads, audit logs, or admin source-review data.
- Admin source review requires `admin` or `system_admin`.

## Verification

Run focused checks:

```sh
node --test --test-concurrency=1 tests/auth-context.test.mjs tests/tenant-scope.test.mjs tests/server-services.test.mjs
```

Run the full release gate:

```sh
npm run verify:ci
```

## Closed Beta Setup Rule

Before any non-local beta environment is enabled:

1. Set `APP_ENV=closed-beta` or stricter.
2. Inject a real AuthProvider implementation.
3. Confirm no request path can fall back to `dev-token`.
4. Confirm user id and organization id resolve from the verified session.
5. Run tenant negative tests and admin source-review role tests.

## Troubleshooting

If local development fails with mock-auth errors:

- Confirm `APP_ENV` and `NODE_ENV` are not set to production-like values.
- Confirm the process was restarted after env changes.
- Use `npm run dev:api` for local development, not a production-like env.

If a user sees another user's record:

- Stop the release.
- Reproduce with `tests/tenant-scope.test.mjs`.
- Check that the service path uses repository scoped methods or `findOwned`.
- Add a negative cross-user test before changing code.

## Pause Lines

Do not add expert-side case access, marketplace behavior, success-fee, platform take-rate, proxy drafting/submission, jGrants POST, production `SubmissionAdapter`, or payment behavior through auth changes.
