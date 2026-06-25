# Development Workflow

This project uses an Issue / PR / handoff workflow for Phase 2 and later work.

## Source of Truth

- GitHub Issues are the source of truth for planned work.
- Each implementation PR should link exactly one primary issue.
- Large initiatives should be split into small issues that can be reviewed and shipped independently.
- Do not start implementation work from an untracked chat-only request unless the change is trivial documentation.

## Labels

- `phase:2`: Phase 2 alpha work.
- `priority:P0`: Blocking or highest-priority work.
- `priority:P1`: Important next work.
- `priority:P2`: Useful follow-up work.
- `type:feature`: Product feature work.
- `type:data`: Data, source, fixture, or refresh work.
- `type:infra`: CI, deployment, security boundary, or operational work.
- `type:process`: Workflow and project-management work.
- `status:ready`: Ready to implement.
- `status:blocked`: Waiting for a decision or external dependency.

## Branch Rules

- Branch from `main`.
- Branch names should use `codex/<short-description>`.
- One branch should address one primary issue.
- Keep unrelated cleanup out of feature branches.
- Direct pushes to `main` are not the default workflow. Use them only for explicit emergency repair.
- Configure repository-level branch protection for `main` when the GitHub plan supports it.

## PR Rules

- Open a draft PR after the first coherent commit.
- PR title format: `[codex] <short summary>`.
- PR body must include:
  - linked issue,
  - scope,
  - out of scope,
  - validation,
  - handoff notes,
  - risks and follow-ups.
- PRs should stay draft until local validation passes.
- PRs can become ready for review after GitHub Actions passes.

## Validation Gates

Default validation:

```sh
npm run verify:ci
```

For visible UI work, also run a browser check and attach the screenshot or artifact path in the PR handoff.

For data or matching work, include the fixture/source change and run:

```sh
npm run test:synthetic
npm run score:multidim
```

## Merge Rules

- Merge only after GitHub Actions passes.
- The PR handoff must be complete before merge.
- The linked issue should be closed by the PR when the acceptance criteria are satisfied.
- If a PR intentionally leaves follow-up work, create or link the follow-up issue before merge.
- Before Track L1 legal opinion is complete, do not merge executable marketplace, success-fee, platform-take-rate, proxy drafting/submission, jGrants POST, or production `SubmissionAdapter` work.

## Handoff Rules

Every PR must leave enough context for another engineer or agent to resume without re-reading the whole thread.

Use `docs/handoff-template.md` for long handoffs. Short PRs can use the handoff section in `.github/pull_request_template.md`.

Minimum handoff content:

- what changed,
- what was verified,
- what decisions were made,
- what remains,
- exact next command or next issue when work continues.
