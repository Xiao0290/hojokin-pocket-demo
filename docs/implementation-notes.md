# Implementation Notes

## 2026-06-20 Phase 1 kickoff

This repository currently contains a Vite + React clickable demo derived from the product video. Formal Phase 1 development starts from the documents in `docs/` and keeps the existing demo only as a runnable shell.

Authoritative inputs:

- `docs/補助金ポケット_Phase1_Codex開発要件定義.md` is the product and engineering requirement source.
- `docs/MVP_技術仕様.md` is the API, data, and architecture source.
- `design-system/` is the current design-system source of truth.
- `.agents/skills/hojokin-pocket-design/` is a copied skill version of the same design system.

Current adaptation:

- The app stays in the existing Vite structure for now instead of forcing the future `apps/mobile` monorepo layout.
- `src/ds.js` remains the design-system adapter and re-exports React components from `design-system/project/components`.
- `src/main.jsx` imports `design-system/project/styles.css` before app chrome CSS.
- Phase 2 video-demo flows were removed from the active app route map: expert matching, chat, payment, and jGrants submission are not part of Phase 1.
- The bottom tab label is `申請準備`, not `申請`.
- Legal copy is guarded by `npm run test:legal-copy`.

Phase 1 boundary:

- The app helps users find subsidy candidates and prepare an editable draft.
- AI output is framed as draft support for the applicant.
- Expert consultation is a waitlist placeholder only.
- jGrants is treated as an external official site to check, not as an in-app submission target.
- Company-specific adoption-rate predictions are not shown.

Next implementation wave:

1. Replace the static navigation stack with a Phase 1 screen map: login, diagnosis home, progress, results, detail, draft generation, draft editor, applications preparation, messages placeholder, my page.
2. Add URL validation and SSRF-safe validation tests.
3. Add seed subsidy fixtures with `sourceUrl`, `lastSeenAt`, hard rules, and warnings.
4. Add mock API/SSE adapters before introducing real backend services.
5. Add editable business-plan sections and export disclaimer tests.
