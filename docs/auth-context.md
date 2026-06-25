# AuthContext Boundary

Created: 2026-06-20 JST  

## Status

`server/authContext.mjs` defines the Closed Beta authentication boundary. It carries the current user, organization id, role, provider, token type, environment, and scoped access object.

The current local MVP still uses mock auth in development and test. Production-like environments fail closed if a mock provider or dev token is used.

## Production-Like Environments

Mock auth is blocked when either `APP_ENV` or `NODE_ENV` resolves to:

- `production`
- `staging`
- `beta`
- `closed-beta`

Local development and automated tests can still use dev login.

## Service Behavior

- `devLogin()` returns the local `dev-token` only outside production-like environments.
- `authUser()` and internal scoped service calls go through AuthContext validation.
- `currentAccessScope()` uses `authContext.accessScope`, so future organization-aware access rules can be added without changing every service call.

## Boundaries

- This does not add external OAuth, OIDC, Cognito, LINE, Google, or gBizID auth.
- This does not enable production beta access by itself.
- This does not grant expert access to user cases.
- No marketplace, success-fee, platform take-rate, proxy drafting/submission, jGrants POST, or production `SubmissionAdapter` is introduced.
