# Phase 1 E2E Tests

This folder is reserved for Phase 1 local end-to-end test assets. The runnable
script currently lives in `scripts/e2e-phase1-mvp.mjs` so it can be invoked
directly with Node before `package.json` is wired by the main agent.

Default command:

```bash
node scripts/e2e-phase1-mvp.mjs
```

Default local services:

- API: `http://127.0.0.1:8787`
- Vite frontend: `http://127.0.0.1:5173`

The script covers the happy path from dev login through diagnosis, match detail,
business-plan edit/export, expert waitlist, notification settings, and analytics
verification.

Browser validation is performed with Playwright CLI during visual review runs.
Screenshots and traces should be saved under `output/playwright/` and treated as
review artifacts, while the Node E2E remains the CI smoke path.
