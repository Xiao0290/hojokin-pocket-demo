# Claude CLI LLM Provider

This provider is a local Phase 2 unblocker for real Claude-generated draft
plans while AWS Bedrock runtime quotas are blocked.

It uses Claude Code non-interactive mode (`claude -p`) from the local machine.
It is not a production backend integration, not an AWS deployment path, and not
a shared customer-facing service account.

## When To Use

Use `LLM_PROVIDER=claude_cli` only for local professional-validation demos and
development checks where the owner is comfortable using their Claude Code plan
or Claude usage credits.

Default CI and development remain free deterministic templates:

```bash
LLM_PROVIDER=local npm run dev:api
```

## Local Setup

Confirm Claude Code is installed and authenticated:

```bash
claude --version
claude -p --model sonnet --tools '' --no-session-persistence \
  --system-prompt 'Return only the requested text.' \
  'Return exactly: ok'
```

Start the API with Claude CLI plan generation:

```bash
LLM_PROVIDER=claude_cli \
CLAUDE_CLI_MODEL=haiku \
LLM_DAILY_BUDGET_USD=5 \
LLM_MONTHLY_BUDGET_USD=50 \
LLM_MAX_REQUEST_USD=0.05 \
LLM_MAX_OUTPUT_TOKENS=900 \
npm run dev:api
```

`CLAUDE_CLI_MODEL=haiku` is the default for low-cost local demos. Set
`CLAUDE_CLI_MODEL=sonnet` only when the extra quality is worth the extra spend.

The adapter also passes `--max-budget-usd` to `claude -p`, but Claude CLI can
return after that soft stop has already been exceeded. Treat it as a secondary
guard, not the source of truth. The app-side preflight budget check and the
ledger record are the primary cost-control mechanisms.

By default the adapter uses a compact prompt and does not enable Claude CLI's
JSON-schema validator, because schema validation can add extra model work. For
debugging only:

```bash
CLAUDE_CLI_PROMPT_MODE=full
CLAUDE_CLI_JSON_SCHEMA=1
```

## Billing And Credentials

Claude Code can authenticate with a Claude Pro/Max subscription. Anthropic also
has usage credits that are billed separately at standard API rates after plan
limits or for credit-backed usage. Check Claude Settings > Usage before demos.

The adapter removes `ANTHROPIC_API_KEY` from the child process by default so a
local subscription session is not accidentally replaced by direct API-key
billing. To intentionally allow API-key billing for this adapter, set:

```bash
CLAUDE_CLI_ALLOW_API_KEY=1
```

Every attempted plan generation writes to the existing LLM usage ledger:

```bash
curl http://127.0.0.1:8787/v1/admin/llm-usage
```

For Claude CLI, the ledger uses the CLI result's `total_cost_usd` when present,
including budget-stop errors that still consumed credits.

## Boundaries

- No production deployment uses this provider by default.
- Do not put personal Claude subscription credentials into shared servers.
- Do not use this provider for marketplace, success-fee, platform-take-rate,
  proxy drafting/submission, jGrants POST, or production SubmissionAdapter work.
- Generated plans remain applicant-reviewable drafts and require human review.
